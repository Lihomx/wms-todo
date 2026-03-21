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

    // Sync outbound orders (use detail API to get productList, expressList, storeName)

  // Clean MEL tracking numbers: MEL46695611578FMDOF01 -> 46695611578
  const cleanTrackNo = (raw: string): string => {
    if (!raw) return ''
    const r = raw.trim()
    // MercadoLibre label format: MEL{trackNo}FMDOF01
    if (r.startsWith('MEL') && r.includes('FMDOF')) {
      const stripped = r.replace(/^MEL/, '').replace(/FMDOF\w+$/, '')
      if (stripped) return stripped
    }
    return r
  }

  const PLATFORM_MAP: Record<string,string> = {
    '1':'AliExpress','2':'Amazon','3':'Amazon VC','4':'eBay','5':'Lazada',
    '6':'Shopee','7':'Shopify','8':'Walmart','9':'Wayfair','10':'MercadoLibre',
    '11':'Wish','12':'Other','14':'Woocommerce','15':'HomeDepot','16':'Overstock',
    '17':'Joom','18':'Tophatter','20':'Shoplazza','21':'Jumia','22':'TikTok',
    '23':'Xshoppy','24':'Shopline','25':'Allegro','27':'Etsy','28':'Allvalue',
    '29':'Fnac','30':'Rakuten','31':'Shoplus','32':'Sears','33':'Shein','34':'Temu','35':'Yahoo',
  }

    try {
      // Step 1: get all order numbers from pageList
      const listOrders = await fetchPages(appKey, appSecret, '/v1/outboundOrder/pageList', {}, 50, 5)
      const activeOrders = listOrders.filter((o:any)=>![3,4].includes(o.status))
      
      // Step 2: fetch detail in batches of 50 to get full data
      const BATCH = 50
      const allDetails: any[] = []
      for(let i=0; i<activeOrders.length; i+=BATCH) {
        const batch = activeOrders.slice(i, i+BATCH).map((o:any)=>o.outboundOrderNo).filter(Boolean)
        if(!batch.length) continue
        try {
          const dData = {outboundOrderNoList: batch}
          const dTime = String(Math.floor(Date.now()/1000))
          const dAuth = generateAuthcode(appKey, appSecret, dTime, dData)
          const dRes  = await fetch(`${API_BASE}/v1/outboundOrder/detail?authcode=${dAuth}`, {
            method:'POST', headers:{'Content-Type':'application/json'},
            body: JSON.stringify({appKey, data:dData, reqTime:dTime})
          })
          const dJson = await dRes.json()
          const details = dJson.data ?? []
          allDetails.push(...(Array.isArray(details)?details:[]))
        } catch(e:any) { /* skip failed batch */ }
      }
      
      let c=0,s=0
      for(const o of allDetails) {
        const no=String(o.outboundOrderNo??''); if(!no){s++;continue}
        // Map status: 0-草稿,2-处理中,3-已出库,4-已取消,5-异常
        const todoStatus = o.status===3?2 : o.status===4?3 : 0
        
        // productList from detail API
        const productList = (o.productList??[]).map((p:any)=>({
          sku: p.sku??'', productName: p.productName??'', quantity: p.quantity??0,
        }))
        // expressList from detail API  
        const expressList = (o.expressList??[]).map((e:any)=>({
          trackNo: e.trackNo??'', weight: e.weight??0,
          length: e.length??0, width: e.width??0, height: e.height??0,
          pkgSkuNumInfo: e.pkgSkuNumInfo??'',
        }))
        // Track numbers: apply cleanTrackNo to strip MEL...FMDOF01 format
        const expressTrackNos = expressList.map((e:any)=>e.trackNo).filter(Boolean).map(cleanTrackNo)
        const rawListNos = Array.isArray(o.logisticsTrackNos)&&o.logisticsTrackNos.length>0
          ? o.logisticsTrackNos.filter(Boolean).map(cleanTrackNo)
          : (o.logisticsTrackNo ? [cleanTrackNo(o.logisticsTrackNo)] : [])
        const trackNos = expressTrackNos.length>0 ? expressTrackNos : rawListNos
        const trackNo = trackNos[0] ?? ''

        const r=await upsert(supabase,DEFAULT_TENANT,code,{
          title:`【一件代发】${no}`,category:'出库作业',priority:2,
          status:todoStatus,
          lingxing_order_no:no,source:'lingxing_auto',
          description:`${o.salesPlatform??'-'} | ${o.logisticsCarrier||o.logisticsChannel||'-'} | ${o.receiver??'-'}`,
          extra_data:{
            outboundOrderNo:   no,
            // Platform: store both code and name
            salesPlatform:     String(o.salesPlatform??''),
            salesPlatformName: PLATFORM_MAP[String(o.salesPlatform??'')] ?? o.salesPlatformName ?? String(o.salesPlatform??''),
            // Logistics
            logisticsChannel:  o.logisticsChannel??'',
            logisticsCarrier:  o.logisticsCarrier??'',
            // Track no: listAPI has it even when expressList is empty (e.g. 待处理 status)
            logisticsTrackNo:  trackNo,
            logisticsTrackNos: trackNos,
            // Order info
            storeName:         o.storeName??'',
            subOrderTypeName:  o.subOrderTypeName??'',   // 订单品种类型 e.g. "单品单件"
            statusName:        o.statusName??'',          // 状态中文名
            orderTypeName:     o.orderTypeName??'',
            // Receiver
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
            // Warehouse
            whCode:            o.whCode??'',
            whName:            o.whName??'',
            // Order refs
            referOrderNo:      o.referOrderNo??'',
            platformOrderNo:   o.platformOrderNo??'',
            // Times
            orderCreateTime:   o.orderCreateTime??'',
            outboundTime:      o.outboundTime??'',
            canceledTime:      o.canceledTime??'',
            interceptTime:     o.interceptTime??'',
            exceptionDesc:     o.exceptionDesc??'',
            remark:            o.remark??'',
            // Cost
            costTotal:         o.costTotal??0,
            costCurrencyCode:  o.costCurrencyCode??'',
            // Products & packages (from detail API)
            productList,
            expressList,
          },
        })
        if(r==='created')c++; else s++
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
