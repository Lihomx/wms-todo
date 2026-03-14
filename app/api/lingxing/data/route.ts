export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/lingxing/data?type=warehouses|inbound|outbound|bigOutbound|returns|inventory|all
 * 无需传 tenantId，自动读取默认租户
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { createHmac } from 'crypto'
import { decrypt } from '@/lib/crypto'

const API_BASE    = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

function sign(appKey: string, appSecret: string, reqTime: string, data: Record<string,any>): string {
  // 正确算法：appKey固定最前，业务参数key转小写字典序排序拼接values，reqTime固定最后
  const v = Object.entries(data).map(([k,v])=>[k.toLowerCase(),v] as [string,any]).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>String(v)).join('')
  return createHmac('sha256',appSecret).update(appKey+v+reqTime).digest('hex')
}

async function omsPost(appKey: string, appSecret: string, endpoint: string, data: Record<string,any>={}): Promise<any> {
  const reqTime  = String(Math.floor(Date.now()/1000))
  const authcode = sign(appKey,appSecret,reqTime,data)
  const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`,{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({appKey,...data,reqTime}),
  })
  if(!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const code  = json.code ?? json.status
  if(code!==200&&code!==0&&code!=='200'&&code!=='0') throw new Error(`code=${code}: ${json.message??json.msg??''}`)
  return json.data ?? json
}

async function fetchPages(appKey: string, appSecret: string, endpoint: string, params: Record<string,any>={}): Promise<{items:any[];total:number}> {
  const all: any[] = []
  let page = 1
  while(true){
    const data  = await omsPost(appKey,appSecret,endpoint,{...params,page,pageSize:50})
    const items: any[] = Array.isArray(data)?data:(data?.list??data?.records??data?.rows??[])
    all.push(...items)
    const total = Number(data?.total??data?.totalCount??0)
    if(items.length<50||(total>0&&all.length>=total)) break
    page++
    await new Promise(r=>setTimeout(r,250))
  }
  return {items:all,total:all.length}
}

// All supported data types with their config
const DATA_CONFIGS: Record<string,{label:string;endpoint:string;params?:Record<string,any>;isOptions?:boolean}> = {
  warehouses:  {label:'仓库列表',       endpoint:'/v1/warehouse/options',             isOptions:true},
  inbound:     {label:'入库单',         endpoint:'/v1/inboundOrder/pageList'},
  outbound:    {label:'小包出库单',     endpoint:'/v1/outboundOrder/pageList'},
  bigOutbound: {label:'大货出库单',     endpoint:'/v1/bigOutboundOrder/pageList'},
  returns:     {label:'退件单',         endpoint:'/v1/returnOrder/pageList'},
  inventory:   {label:'综合库存',       endpoint:'/v1/integratedInventory/pageOpen',
                params:{
                  startTime: new Date(Date.now()-90*864e5).toISOString().split('T')[0]+' 00:00:00',
                  endTime:   new Date().toISOString().split('T')[0]+' 23:59:59',
                  inventoryType: 1,
                }},
}

export async function GET(req: NextRequest) {
  try {
    const {searchParams} = new URL(req.url)
    const type     = searchParams.get('type') ?? 'all'
    const tenantId = searchParams.get('tenantId') ?? DEFAULT_TENANT

    const supabase = getSupabaseAdminClient()
    const {data:cred} = await supabase.from('lingxing_credentials')
      .select('app_key,app_secret,auth_status').eq('tenant_id',tenantId).single()
    if(!cred||cred.auth_status!==1)
      return NextResponse.json({error:'未绑定领星账号，请先在系统设置中绑定'},{status:401})

    const appKey    = decrypt(cred.app_key)
    const appSecret = decrypt(cred.app_secret)

    // Single type
    if(type!=='all'){
      const cfg = DATA_CONFIGS[type]
      if(!cfg) return NextResponse.json({error:`不支持的数据类型: ${type}`},{status:400})
      try {
        if(cfg.isOptions){
          const data  = await omsPost(appKey,appSecret,cfg.endpoint,{})
          const items = Array.isArray(data)?data:(data?.list??data?.records??[])
          return NextResponse.json({type,label:cfg.label,items,total:items.length,timestamp:new Date().toISOString()})
        }
        const result = await fetchPages(appKey,appSecret,cfg.endpoint,cfg.params??{})
        return NextResponse.json({type,label:cfg.label,...result,timestamp:new Date().toISOString()})
      } catch(e:any){
        return NextResponse.json({type,label:cfg.label,items:[],total:0,error:e.message,timestamp:new Date().toISOString()})
      }
    }

    // All: probe each type with 1 page to get count
    const summary: Record<string,{label:string;total:number;sample:any[];error?:string}> = {}
    for(const [key,cfg] of Object.entries(DATA_CONFIGS)){
      try {
        if(cfg.isOptions){
          const data  = await omsPost(appKey,appSecret,cfg.endpoint,{})
          const items = Array.isArray(data)?data:(data?.list??data?.records??[])
          summary[key] = {label:cfg.label,total:items.length,sample:items.slice(0,3)}
        } else {
          const data  = await omsPost(appKey,appSecret,cfg.endpoint,{...cfg.params??{},page:1,pageSize:10})
          const items: any[] = Array.isArray(data)?data:(data?.list??data?.records??data?.rows??[])
          const total = Number(data?.total??data?.totalCount??items.length)
          summary[key] = {label:cfg.label,total,sample:items.slice(0,2)}
        }
        await new Promise(r=>setTimeout(r,150))
      } catch(e:any){
        summary[key] = {label:cfg.label,total:0,sample:[],error:e.message}
      }
    }
    return NextResponse.json({type:'all',summary,timestamp:new Date().toISOString()})

  } catch(err:any){
    return NextResponse.json({error:err.message},{status:500})
  }
}
