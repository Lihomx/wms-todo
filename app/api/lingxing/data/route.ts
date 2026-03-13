/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { createHmac } from 'crypto'
import { decrypt } from '@/lib/crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

function sign(appKey: string, appSecret: string, reqTime: string, data: Record<string,any>): string {
  const v = Object.entries(data).map(([k,v])=>[k.toLowerCase(),v] as [string,any]).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>String(v)).join('')
  return createHmac('sha256',appSecret).update(appKey+v+reqTime).digest('hex')
}

async function omsReq(appKey: string, appSecret: string, endpoint: string, data: Record<string,any>={}): Promise<any> {
  const reqTime=String(Math.floor(Date.now()/1000))
  const authcode=sign(appKey,appSecret,reqTime,data)
  const res=await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appKey,...data,reqTime})})
  if(!res.ok) throw new Error(`HTTP ${res.status}`)
  const json=await res.json()
  const code=json.code??json.status
  if(code!==200&&code!==0&&code!=='200'&&code!=='0') throw new Error(`code=${code} ${json.message??json.msg??''}`)
  return json.data??json
}

async function fetchAll(appKey: string, appSecret: string, endpoint: string, params: Record<string,any>={}): Promise<{items:any[];total:number;error?:string}> {
  const all:any[]=[]
  let page=1
  try {
    while(true){
      const data=await omsReq(appKey,appSecret,endpoint,{...params,page,pageSize:50})
      const items:any[]=Array.isArray(data)?data:(data?.list??data?.records??data?.rows??data?.data??[])
      all.push(...items)
      const total=data?.total??data?.totalCount??null
      if(items.length<50) break
      if(total!==null&&all.length>=Number(total)) break
      page++
      await new Promise(r=>setTimeout(r,250))
    }
    return {items:all,total:all.length}
  } catch(e:any){
    return {items:all,total:all.length,error:e.message}
  }
}

const ENDPOINTS: Record<string,{label:string;endpoint:string;params?:Record<string,any>}> = {
  warehouses:        {label:'仓库列表',        endpoint:'/v1/warehouse/options'},
  inbound:           {label:'入库单',          endpoint:'/v1/inboundOrder/pageList'},
  outbound:          {label:'小包出库（一件代发）', endpoint:'/v1/outboundOrder/pageList'},
  bigOutbound:       {label:'大货出库（送仓）',  endpoint:'/v1/bigOutboundOrder/pageList'},
  returns:           {label:'退件单',          endpoint:'/v1/returnOrder/pageList'},
  inventory:         {label:'综合库存',         endpoint:'/v1/integratedInventory/pageOpen',
                      params:{startTime:new Date(Date.now()-90*864e5).toISOString().split('T')[0]+' 00:00:00',endTime:new Date().toISOString().split('T')[0]+' 23:59:59',inventoryType:1}},
  customers:         {label:'客户列表',         endpoint:'/v1/customer/pageList'},
  products:          {label:'商品/SKU',        endpoint:'/v1/product/pageList'},
  workOrders:        {label:'工单列表',         endpoint:'/v1/workOrder/pageList'},
  locations:         {label:'库位列表',         endpoint:'/v1/location/pageList'},
  locationInventory: {label:'库位库存',         endpoint:'/v1/locationInventory/pageList'},
  transferOrders:    {label:'移库单',          endpoint:'/v1/transferOrder/pageList'},
  adjustOrders:      {label:'库存调整单',       endpoint:'/v1/adjustOrder/pageList'},
  carriers:          {label:'承运商列表',       endpoint:'/v1/carrier/options'},
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const type     = searchParams.get('type') ?? 'all'
    const tenantId = searchParams.get('tenantId') ?? process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? ''

    const supabase = getSupabaseAdminClient()
    const { data: cred } = await supabase.from('lingxing_credentials').select('app_key,app_secret,auth_status,warehouse_ids').eq('tenant_id',tenantId).single()
    if(!cred||cred.auth_status!==1) return NextResponse.json({error:'未绑定领星账号'},{status:401})

    const appKey    = decrypt(cred.app_key)
    const appSecret = decrypt(cred.app_secret)

    // Single type
    if(type!=='all'&&ENDPOINTS[type]){
      const {label,endpoint,params} = ENDPOINTS[type]
      if(endpoint==='/v1/warehouse/options'){
        try {
          const data=await omsReq(appKey,appSecret,endpoint,{})
          const items=Array.isArray(data)?data:(data?.list??data?.records??[])
          return NextResponse.json({type,label,items,total:items.length,timestamp:new Date().toISOString()})
        } catch(e:any){
          return NextResponse.json({type,label,items:[],total:0,error:e.message})
        }
      }
      const result=await fetchAll(appKey,appSecret,endpoint,params??{})
      return NextResponse.json({type,label,...result,timestamp:new Date().toISOString()})
    }

    // All types summary
    const summary: Record<string,{label:string;total:number;error?:string;sample:any[]}> = {}
    for(const [key,{label,endpoint,params}] of Object.entries(ENDPOINTS)){
      try {
        if(endpoint==='/v1/warehouse/options'){
          const data=await omsReq(appKey,appSecret,endpoint,{})
          const items=Array.isArray(data)?data:(data?.list??data?.records??[])
          summary[key]={label,total:items.length,sample:items.slice(0,3)}
        } else {
          const data=await omsReq(appKey,appSecret,endpoint,{...params??{},page:1,pageSize:10})
          const items=Array.isArray(data)?data:(data?.list??data?.records??data?.rows??data?.data??[])
          const total=data?.total??data?.totalCount??items.length
          summary[key]={label,total:Number(total),sample:items.slice(0,2)}
        }
        await new Promise(r=>setTimeout(r,150))
      } catch(e:any){
        summary[key]={label,total:0,error:e.message,sample:[]}
      }
    }
    return NextResponse.json({type:'all',summary,timestamp:new Date().toISOString()})

  } catch(err:any){
    return NextResponse.json({error:err.message},{status:500})
  }
}
