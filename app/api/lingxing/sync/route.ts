/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcodeV2 } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE       = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

async function omsPost(appKey: string, appSecret: string, endpoint: string, data: Record<string,any>={}) {
  const reqTime  = String(Math.floor(Date.now()/1000))
  const authcode = generateAuthcodeV2(appKey, appSecret, reqTime, data)
  const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`, {
    method:'POST', headers:{'Content-Type':'application/json'},
    body: JSON.stringify({ appKey, reqTime, authcode, data }),
  })
  if(!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const code = json.code ?? json.status
  if(code!==200&&code!==0&&code!=='200'&&code!=='0') throw new Error(`code=${code}: ${json.message??json.msg??''}`)
  return json.data ?? json
}

async function fetchPages(appKey: string, appSecret: string, endpoint: string, params: Record<string,any>={}): Promise<any[]> {
  const all: any[] = []
  let page = 1
  while(true) {
    const data  = await omsPost(appKey, appSecret, endpoint, {...params, page, pageSize:50})
    const items: any[] = Array.isArray(data)?data:(data?.list??data?.records??data?.rows??[])
    all.push(...items)
    const total = Number(data?.total??data?.totalCount??0)
    if(items.length<50||(total>0&&all.length>=total)) break
    page++
    await new Promise(r=>setTimeout(r,300))
  }
  return all
}

async function upsertTodo(supabase: any, tenantId: string, todo: {
  title:string; category:string; priority:number; status?:number
  due_date?:string|null; description?:string|null; lingxing_order_no:string; source:string
}): Promise<'created'|'skipped'> {
  const { data:existing } = await supabase.from('todos').select('id').eq('tenant_id',tenantId).eq('lingxing_order_no',todo.lingxing_order_no).maybeSingle()
  if(existing) return 'skipped'
  await supabase.from('todos').insert({tenant_id:tenantId, status:0, ...todo})
  return 'created'
}

async function syncInbound(appKey:string, appSecret:string, supabase:any, tenantId:string) {
  const orders = await fetchPages(appKey, appSecret, '/v1/inboundOrder/pageList', {})
  let created=0, skipped=0
  for(const o of orders) {
    if([4,5].includes(o.status)){skipped++;continue}
    const orderNo = String(o.orderNo??o.order_no??o.id??'')
    if(!orderNo){skipped++;continue}
    const r = await upsertTodo(supabase, tenantId, {
      title: o.status===3?`【待上架】${orderNo}`:`【待入库】${orderNo}`,
      category:'入库作业', priority:o.status===3?1:2, lingxing_order_no:orderNo, source:'lingxing_auto',
      description:`客户：${o.customerName??o.customer_name??'-'} | 预计件数：${o.expectQty??o.expect_qty??'-'}`,
      due_date: o.expectArriveTime?o.expectArriveTime.split(' ')[0]:null,
    })
    r==='created'?created++:skipped++
  }
  return {created,skipped}
}

async function syncOutbound(appKey:string, appSecret:string, supabase:any, tenantId:string) {
  const orders = await fetchPages(appKey, appSecret, '/v1/outboundOrder/pageList', {})
  let created=0, skipped=0
  for(const o of orders) {
    if([3,4].includes(o.status)){skipped++;continue}
    const orderNo = String(o.orderNo??o.order_no??o.id??'')
    if(!orderNo){skipped++;continue}
    const r = await upsertTodo(supabase, tenantId, {
      title:`【一件代发】${orderNo}`, category:'出库作业', priority:o.status===2?1:2,
      lingxing_order_no:orderNo, source:'lingxing_auto',
      description:`平台：${o.platform??'-'} | 收件人：${o.receiverName??o.receiver_name??'-'}`,
    })
    r==='created'?created++:skipped++
  }
  return {created,skipped}
}

async function syncBigOutbound(appKey:string, appSecret:string, supabase:any, tenantId:string) {
  const orders = await fetchPages(appKey, appSecret, '/v1/bigOutboundOrder/pageList', {})
  let created=0, skipped=0
  for(const o of orders) {
    if([3,4].includes(o.status)){skipped++;continue}
    const orderNo = String(o.orderNo??o.order_no??o.id??'')
    if(!orderNo){skipped++;continue}
    const r = await upsertTodo(supabase, tenantId, {
      title:`【送仓出库】${orderNo}`, category:'出库作业', priority:2,
      lingxing_order_no:orderNo, source:'lingxing_auto',
      description:`目的地：${o.destination??'-'} | 件数：${o.totalQty??o.total_qty??'-'}`,
    })
    r==='created'?created++:skipped++
  }
  return {created,skipped}
}

async function syncReturns(appKey:string, appSecret:string, supabase:any, tenantId:string) {
  const orders = await fetchPages(appKey, appSecret, '/v1/returnOrder/pageList', {})
  let created=0, skipped=0
  for(const o of orders) {
    if([2,3].includes(o.status)){skipped++;continue}
    const orderNo = String(o.orderNo??o.order_no??o.id??'')
    if(!orderNo){skipped++;continue}
    const r = await upsertTodo(supabase, tenantId, {
      title:`【退件处理】${orderNo}`, category:'退货处理', priority:1,
      lingxing_order_no:orderNo, source:'lingxing_auto',
      description:`客户：${o.customerName??o.customer_name??'-'}`,
    })
    r==='created'?created++:skipped++
  }
  return {created,skipped}
}

async function syncInventory(appKey:string, appSecret:string, supabase:any, tenantId:string) {
  const today = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now()-90*864e5).toISOString().split('T')[0]
  const items = await fetchPages(appKey, appSecret, '/v1/integratedInventory/pageOpen', {
    inventoryType:1, startTime:`${start} 00:00:00`, endTime:`${today} 23:59:59`
  })
  let created=0, skipped=0
  for(const item of items) {
    const qty = Number(item.availableQty??item.available_qty??item.qty??99)
    if(qty>10){skipped++;continue}
    const sku = String(item.sku??item.skuCode??item.sku_code??'')
    if(!sku){skipped++;continue}
    const r = await upsertTodo(supabase, tenantId, {
      title:`【库存预警】${sku} 剩余 ${qty}`,
      category:'库存管理', priority:qty<=3?1:2,
      lingxing_order_no:`inv_${sku}`, source:'lingxing_auto',
      description:`SKU: ${sku} | 可用库存: ${qty}`,
    })
    r==='created'?created++:skipped++
  }
  return {created,skipped}
}

export async function POST(req: NextRequest) {
  try {
    const body     = await req.json().catch(()=>({}))
    const tenantId = body.tenantId ?? DEFAULT_TENANT
    const type     = body.type ?? 'all'

    const supabase = getSupabaseAdminClient()
    const {data:cred} = await supabase.from('lingxing_credentials')
      .select('app_key,app_secret,auth_status,warehouse_ids').eq('tenant_id',tenantId).single()
    if(!cred||cred.auth_status!==1) return NextResponse.json({error:'未绑定领星账号'},{status:401})

    const appKey    = decrypt(cred.app_key)
    const appSecret = decrypt(cred.app_secret)

    const run = async (fn:()=>Promise<{created:number;skipped:number}>) => {
      try { const r=await fn(); return {success:true,message:`新建 ${r.created} 条，跳过 ${r.skipped} 条`,...r,errors:[]} }
      catch(e:any) { return {success:false,message:e.message,created:0,skipped:0,errors:[e.message]} }
    }

    if(type==='all') {
      const [inbound,outbound,bigOutbound,returns,inventory] = await Promise.all([
        run(()=>syncInbound(appKey,appSecret,supabase,tenantId)),
        run(()=>syncOutbound(appKey,appSecret,supabase,tenantId)),
        run(()=>syncBigOutbound(appKey,appSecret,supabase,tenantId)),
        run(()=>syncReturns(appKey,appSecret,supabase,tenantId)),
        run(()=>syncInventory(appKey,appSecret,supabase,tenantId)),
      ])
      await supabase.from('lingxing_credentials').update({last_sync_at:new Date().toISOString()}).eq('tenant_id',tenantId)
      const total = [inbound,outbound,bigOutbound,returns,inventory].reduce((s,r)=>s+r.created,0)
      return NextResponse.json({success:true,message:`全部同步完成，共新建 ${total} 条待办`,results:{inbound,outbound,bigOutbound,returns,inventory}})
    }

    const handlers: Record<string,()=>Promise<any>> = {
      inbound:     ()=>run(()=>syncInbound(appKey,appSecret,supabase,tenantId)),
      outbound:    ()=>run(()=>syncOutbound(appKey,appSecret,supabase,tenantId)),
      bigOutbound: ()=>run(()=>syncBigOutbound(appKey,appSecret,supabase,tenantId)),
      returns:     ()=>run(()=>syncReturns(appKey,appSecret,supabase,tenantId)),
      inventory:   ()=>run(()=>syncInventory(appKey,appSecret,supabase,tenantId)),
    }
    if(!handlers[type]) return NextResponse.json({error:`不支持: ${type}`},{status:400})
    return NextResponse.json(await handlers[type]())
  } catch(err:any) {
    return NextResponse.json({error:err.message},{status:500})
  }
}
