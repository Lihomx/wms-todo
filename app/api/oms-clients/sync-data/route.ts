/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE       = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

async function omsPost(appKey:string,appSecret:string,endpoint:string,data:Record<string,any>={}) {
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

async function fetchPages(appKey:string,appSecret:string,endpoint:string,params:Record<string,any>={},maxPageSize=50,maxPages=5): Promise<any[]> {
  const all:any[]=[]
  let page=1
  while(page<=maxPages){
    const data=await omsPost(appKey,appSecret,endpoint,{...params,page,pageSize:maxPageSize})
    const items:any[]=Array.isArray(data)?data:(data?.list??data?.records??data?.rows??[])
    all.push(...items)
    const total=Number(data?.total??data?.totalCount??0)
    if(items.length<maxPageSize||(total>0&&all.length>=total)) break
    page++
  }
  return all
}

async function upsert(supabase:any, tenantId:string, customerCode:string, todo:{
  title:string;category:string;priority:number;status:number
  description?:string|null;due_date?:string|null
  lingxing_order_no:string;source:string;extra_data?:Record<string,any>
}) {
  const {data:ex}=await supabase.from('todos').select('id,customer_code').eq('tenant_id',tenantId).eq('lingxing_order_no',todo.lingxing_order_no).maybeSingle()
  if(ex) {
    const upd: any = {}
    if(!ex.customer_code && customerCode) upd.customer_code = customerCode
    // Always update extra_data to get latest logistics info
    if(todo.extra_data && Object.keys(todo.extra_data).length > 0) upd.extra_data = todo.extra_data
    if(Object.keys(upd).length) await supabase.from('todos').update(upd).eq('id',ex.id)
    return 'updated'
  }
  const {error}=await supabase.from('todos').insert({tenant_id:tenantId,customer_code:customerCode,...todo})
  if(error) throw new Error(`Insert failed: ${error.message}`)
  return 'created'
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { clientId, customerCode } = body
    const syncType = body.syncType ?? 'all'  // 'all'|'outbound'|'inbound'|'returns'|'inventory'
    if (!clientId) return NextResponse.json({ error: '缺少 clientId' }, { status: 400 })

    const supabase = getSupabaseAdminClient()
    const { data: client } = await supabase.from('oms_clients')
      .select('app_key,app_secret,auth_status,customer_code,customer_name')
      .eq('id', clientId).single()

    if (!client) return NextResponse.json({ error: '客户不存在' }, { status: 404 })
    if (client.auth_status !== 1) return NextResponse.json({ error: '该客户未绑定AppKey，请先在客户管理页绑定' }, { status: 401 })
    if (!client.app_key) return NextResponse.json({ error: '凭证缺失，请重新绑定' }, { status: 401 })

    const appKey    = decrypt(client.app_key)
    const appSecret = decrypt(client.app_secret)
    const code      = customerCode ?? client.customer_code

    const results: Record<string, {created:number;skipped:number;error?:string}> = {}

    // Sync inbound orders
    try {
      const orders = await fetchPages(appKey, appSecret, '/v1/inboundOrder/pageList', {})
      let c=0,s=0
      for(const o of orders) {
        if([4,5].includes(o.status)){s++;continue}
        const no=String(o.inboundOrderNo??o.orderNo??o.id??''); if(!no){s++;continue}
        const r=await upsert(supabase,DEFAULT_TENANT,code,{
          title:`【入库】${no}`,category:'入库作业',priority:o.status===3?1:2,status:0,
          lingxing_order_no:no,source:'lingxing_auto',
          description:`状态：${o.status} | 客户：${o.customerName??code}`,
          due_date:o.expectedDate??null,
        })
        if(r==='created')c++; else if(r==='updated')c++; else s++
      }
      results.inbound = {created:c,skipped:s}
    } catch(e:any) { results.inbound = {created:0,skipped:0,error:e.message} }

    // Sync outbound orders
    try {
      const orders = await fetchPages(appKey, appSecret, '/v1/outboundOrder/pageList', {})
      let c=0,s=0
      for(const o of orders) {
        if([3,4].includes(o.status)){s++;continue}
        const no=String(o.outboundOrderNo??o.orderNo??o.id??''); if(!no){s++;continue}
        const r=await upsert(supabase,DEFAULT_TENANT,code,{
          title:`【一件代发】${no}`,category:'出库作业',priority:2,status:0,
          lingxing_order_no:no,source:'lingxing_auto',
          description:`平台：${o.salesPlatform??'-'} | 物流：${o.logisticsChannel??'-'} | 收件人：${o.receiver??'-'}`,
          extra_data:{
            outboundOrderNo:   no,
            salesPlatform:     o.salesPlatform??'',
            logisticsChannel:  o.logisticsChannel??'',
            logisticsTrackNo:  o.logisticsTrackNo??'',
            logisticsTrackNos: o.logisticsTrackNos??[],
            logisticsCarrier:  o.logisticsCarrier??'',
            receiver:          o.receiver??'',
            telephone:         o.telephone??'',
            companyName:       o.companyName??'',
            taxNum:            o.taxNum??'',
            countryRegionCode: o.countryRegionCode??'',
            countryRegionName: o.countryRegionName??'',
            provinceName:      o.provinceName??'',
            provinceCode:      o.provinceCode??'',
            cityName:          o.cityName??'',
            postCode:          o.postCode??'',
            addressOne:        o.addressOne??'',
            addressTwo:        o.addressTwo??'',
            whCode:            o.whCode??'',
            orderCreateTime:   o.orderCreateTime??'',
            outboundTime:      o.outboundTime??'',
            canceledTime:      o.canceledTime??'',
            interceptTime:     o.interceptTime??'',
            remark:            o.remark??'',
            referOrderNo:      o.referOrderNo??'',
            platformOrderNo:   o.platformOrderNo??'',
            costTotal:         o.costTotal??0,
            costCurrencyCode:  o.costCurrencyCode??'',
            exceptionDesc:     o.exceptionDesc??'',
            productList:       (o.productList??[]).map((p:any)=>({sku:p.sku,productName:p.productName,quantity:p.quantity})),
            expressList:       (o.expressList??[]).map((e:any)=>({trackNo:e.trackNo,weight:e.weight,length:e.length,width:e.width,height:e.height,pkgSkuNumInfo:e.pkgSkuNumInfo})),
          },
        })
        if(r==='created')c++; else if(r==='updated')c++; else s++
      }
      results.outbound = {created:c,skipped:s}
    } catch(e:any) { results.outbound = {created:0,skipped:0,error:e.message} }

    // Sync return orders
    try {
      const orders = await fetchPages(appKey, appSecret, '/v1/returnOrder/pageList', {}, 10)
      let c=0,s=0
      for(const o of orders) {
        if(o.status===4){s++;continue}
        const no=String(o.returnNo??o.id??''); if(!no){s++;continue}
        const typeLabel=o.returnType===2?'买家退件':o.returnType===3?'平台退件':'服务商退件'
        const statusLabel=o.status===0?'草稿':o.status===1?'待入库':o.status===2?'处理中':o.status===3?'已完成':'未知'
        const r=await upsert(supabase,DEFAULT_TENANT,code,{
          title:`【退件】${no}`,category:'退货处理',priority:o.status===3?3:1,
          status:o.status===3?2:0,lingxing_order_no:no,source:'lingxing_auto',
          description:`${typeLabel} | ${statusLabel}`,
        })
        if(r==='created')c++; else if(r==='updated')c++; else s++
      }
      results.returns = {created:c,skipped:s}
    } catch(e:any) { results.returns = {created:0,skipped:0,error:e.message} }

    // Sync inventory warnings
    try {
      const today=new Date().toISOString().split('T')[0]
      const start=new Date(Date.now()-90*864e5).toISOString().split('T')[0]
      const items=await fetchPages(appKey,appSecret,'/v1/integratedInventory/pageOpen',{startTime:`${start} 00:00:00`,endTime:`${today} 23:59:59`})
      let c=0,s=0
      for(const item of items) {
        const qty=Number(item.productStockDtl?.availableAmount??item.availableAmount??99)
        if(qty>10){s++;continue}
        const sku=String(item.sku??''); if(!sku){s++;continue}
        const r=await upsert(supabase,DEFAULT_TENANT,code,{
          title:`【库存预警】${sku} 剩余${qty}件`,category:'库存管理',priority:qty<=3?1:2,status:0,
          lingxing_order_no:`inv_${code}_${sku}`,source:'lingxing_auto',
          description:`SKU:${sku} | 可用:${qty}`,
        })
        if(r==='created')c++; else if(r==='updated')c++; else s++
      }
      results.inventory = {created:c,skipped:s}
    } catch(e:any) { results.inventory = {created:0,skipped:0,error:e.message} }

    // Update last_synced_at
    await supabase.from('oms_clients').update({last_synced_at:new Date().toISOString()}).eq('id',clientId)

    const total = Object.values(results).reduce((s,r)=>s+r.created,0)
    return NextResponse.json({
      success: true,
      message: `${client.customer_name} 同步完成，新建/更新 ${total} 条待办`,
      results
    })
  } catch(err:any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
