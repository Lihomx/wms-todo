/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE       = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

async function omsPost(appKey:string,appSecret:string,endpoint:string,data:Record<string,any>={}){
  const reqTime=String(Math.floor(Date.now()/1000))
  const authcode=generateAuthcode(appKey,appSecret,reqTime,data)
  const body=Object.keys(data).length>0?{appKey,data,reqTime}:{appKey,reqTime}
  const res=await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)})
  if(!res.ok) throw new Error(`HTTP ${res.status}`)
  const json=await res.json()
  const code=json.code??json.status
  if(code!==200&&code!==0&&code!=='200'&&code!=='0') throw new Error(`code=${code}: ${json.message??json.msg??''}`)
  return json.data??json
}

async function fetchPages(appKey:string,appSecret:string,endpoint:string,params:Record<string,any>={},maxPageSize=50): Promise<{items:any[];total:number}>{
  const all:any[]=[]
  let page=1
  while(true){
    const data=await omsPost(appKey,appSecret,endpoint,{...params,page,pageSize:maxPageSize})
    const items:any[]=Array.isArray(data)?data:(data?.list??data?.records??data?.rows??[])
    all.push(...items)
    const total=Number(data?.total??data?.totalCount??0)
    if(items.length<maxPageSize||(total>0&&all.length>=total)) break
    page++; await new Promise(r=>setTimeout(r,250))
  }
  return {items:all,total:all.length}
}

const today=()=>new Date().toISOString().split('T')[0]
const start90=()=>new Date(Date.now()-90*864e5).toISOString().split('T')[0]

const CONFIGS:Record<string,{label:string;endpoint:string;params?:Record<string,any>;isOptions?:boolean;maxPageSize?:number}>={
  warehouses: {label:'仓库列表',endpoint:'/v1/warehouse/options',isOptions:true},
  inbound:    {label:'入库单',  endpoint:'/v1/inboundOrder/pageList'},
  outbound:   {label:'小包出库',endpoint:'/v1/outboundOrder/pageList'},
  bigOutbound:{label:'大货出库',endpoint:'/v1/bigOutboundOrder/pageList'},
  returns:    {label:'退件单',  endpoint:'/v1/returnOrder/pageList', maxPageSize:10},
  inventory:  {label:'综合库存',endpoint:'/v1/integratedInventory/pageOpen',params:{startTime:`${start90()} 00:00:00`,endTime:`${today()} 23:59:59`}},
}

export async function GET(req:NextRequest){
  try{
    const {searchParams}=new URL(req.url)
    const type=searchParams.get('type')?? 'all'
    const tenantId=searchParams.get('tenantId')??DEFAULT_TENANT
    const supabase=getSupabaseAdminClient()
    const clientId=searchParams.get('clientId')
    let appKey='',appSecret=''
    if(clientId){
      const {data:cl}=await supabase.from('oms_clients').select('app_key,app_secret,auth_status').eq('id',clientId).single()
      if(!cl||cl.auth_status!==1||!cl.app_key) return NextResponse.json({error:'该客户未绑定AppKey'},{status:401})
      appKey=decrypt(cl.app_key); appSecret=decrypt(cl.app_secret)
    } else {
      const {data:cred}=await supabase.from('lingxing_credentials').select('app_key,app_secret,auth_status').eq('tenant_id',tenantId).single()
      if(!cred||cred.auth_status!==1) return NextResponse.json({error:'未绑定领星账号'},{status:401})
      appKey=decrypt(cred.app_key); appSecret=decrypt(cred.app_secret)
    }
    if(type!=='all'){
      const cfg=CONFIGS[type]
      if(!cfg) return NextResponse.json({error:`不支持: ${type}`},{status:400})
      try{
        if(cfg.isOptions){const data=await omsPost(appKey,appSecret,cfg.endpoint,{});const items=Array.isArray(data)?data:(data?.list??[]);return NextResponse.json({type,label:cfg.label,items,total:items.length,timestamp:new Date().toISOString()})}
        const result=await fetchPages(appKey,appSecret,cfg.endpoint,cfg.params??{},cfg.maxPageSize??50)
        return NextResponse.json({type,label:cfg.label,...result,timestamp:new Date().toISOString()})
      }catch(e:any){return NextResponse.json({type,label:cfg.label,items:[],total:0,error:e.message,timestamp:new Date().toISOString()})}
    }
    const summary:Record<string,any>={}
    for(const [key,cfg] of Object.entries(CONFIGS)){
      try{
        if(cfg.isOptions){const data=await omsPost(appKey,appSecret,cfg.endpoint,{});const items=Array.isArray(data)?data:(data?.list??[]);summary[key]={label:cfg.label,total:items.length,sample:items.slice(0,2)}}
        else{const data=await omsPost(appKey,appSecret,cfg.endpoint,{...cfg.params??{},page:1,pageSize:10});const items:any[]=Array.isArray(data)?data:(data?.list??data?.records??data?.rows??[]);summary[key]={label:cfg.label,total:Number(data?.total??data?.totalCount??items.length),sample:items.slice(0,2)}}
        await new Promise(r=>setTimeout(r,200))
      }catch(e:any){summary[key]={label:cfg.label,total:0,sample:[],error:e.message}}
    }
    return NextResponse.json({type:'all',summary,timestamp:new Date().toISOString()})
  }catch(err:any){return NextResponse.json({error:err.message},{status:500})}
}
