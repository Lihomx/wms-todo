/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { decrypt, encrypt } from '@/lib/crypto'
import { generateAuthcodeV2 } from '@/lib/lingxing'

const API_BASE       = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

async function callV2(appKey:string, appSecret:string, endpoint:string, data:Record<string,any>={}) {
  const reqTime  = String(Math.floor(Date.now()/1000))
  const authcode = generateAuthcodeV2(appKey, appSecret, reqTime, data)
  const bodyObj  = {appKey, reqTime, data}
  try {
    const res  = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`,{
      method:'POST',headers:{'Content-Type':'application/json'},
      body:JSON.stringify(bodyObj),signal:AbortSignal.timeout(10000),
    })
    const raw  = await res.text()
    let json:any={}; try{json=JSON.parse(raw)}catch{/**/}
    const code = json.code??json.status
    const ok   = code===200||code===0||code==='200'||code==='0'
    return {ok,httpStatus:res.status,responseCode:code,responseMsg:json.message??json.msg??'',
      requestBody:bodyObj,responseRaw:raw.slice(0,500),
      total:json.data?.total??json.data?.totalCount??(Array.isArray(json.data)?json.data.length:null)}
  } catch(e:any){
    return {ok:false,httpStatus:0,responseCode:'ERR',responseMsg:e.message,requestBody:bodyObj,responseRaw:'',total:null}
  }
}

export async function GET(req:NextRequest) {
  const {searchParams} = new URL(req.url)
  const supabase = getSupabaseAdminClient()

  // rebind shortcut
  const rawAK = searchParams.get('ak'), rawAS = searchParams.get('as')
  if(searchParams.get('rebind') && rawAK && rawAS) {
    await supabase.from('lingxing_credentials').upsert({
      tenant_id:DEFAULT_TENANT, app_key:encrypt(rawAK), app_secret:encrypt(rawAS),
      warehouse_ids:['LIHO'], auth_status:1, sync_enabled:true,
    },{onConflict:'tenant_id'})
    const verify = await callV2(rawAK, rawAS, '/v1/warehouse/options', {})
    return NextResponse.json({rebind:'success', verify})
  }

  const {data:cred,error} = await supabase.from('lingxing_credentials')
    .select('app_key,app_secret,auth_status,warehouse_ids').eq('tenant_id',DEFAULT_TENANT).single()
  if(error||!cred) return NextResponse.json({error:`DB: ${error?.message??'无凭证'}`})

  const appKey    = decrypt(cred.app_key)
  const appSecret = decrypt(cred.app_secret)
  const decryptOk = appKey.length>0&&appSecret.length>0

  if(!decryptOk) return NextResponse.json({
    error:'解密后appKey为空，ENCRYPTION_SECRET与绑定时不一致',
    fix:`/api/lingxing/debug?rebind=1&ak=YOUR_AK&as=YOUR_AS`
  })

  const today  = new Date().toISOString().split('T')[0]
  const start90 = new Date(Date.now()-90*864e5).toISOString().split('T')[0]

  const results = await Promise.all([
    callV2(appKey,appSecret,'/v1/warehouse/options',{}),
    callV2(appKey,appSecret,'/v1/inboundOrder/pageList',{page:1,pageSize:10}),
    callV2(appKey,appSecret,'/v1/outboundOrder/pageList',{page:1,pageSize:10}),
    callV2(appKey,appSecret,'/v1/returnOrder/pageList',{page:1,pageSize:10}),
    callV2(appKey,appSecret,'/v1/integratedInventory/pageOpen',{page:1,pageSize:10,inventoryType:1,startTime:`${start90} 00:00:00`,endTime:`${today} 23:59:59`}),
  ].map((p,i)=>p.then(r=>({label:['仓库','入库单','小包出库','退件单','综合库存'][i],...r}))))

  return NextResponse.json({decryptOk,appKeyLen:appKey.length,results,timestamp:new Date().toISOString()})
}
