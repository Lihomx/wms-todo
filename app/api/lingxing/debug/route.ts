/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { decrypt } from '@/lib/crypto'
import { createHmac } from 'crypto'

const API_BASE = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

function sign(appKey: string, appSecret: string, reqTime: string, data: Record<string,any>): string {
  // 全参数（含appKey和reqTime）统一按key小写字典序排序后拼接values
  const all = { appKey, ...data, reqTime }
  const v = Object.entries(all).map(([k,v])=>[k.toLowerCase(),v] as [string,any]).sort(([a],[b])=>a.localeCompare(b)).map(([,v])=>String(v)).join('')
  return createHmac('sha256',appSecret).update(v).digest('hex')
}

async function probe(appKey: string, appSecret: string, label: string, endpoint: string, params: Record<string,any>={}) {
  try {
    const reqTime  = String(Math.floor(Date.now()/1000))
    const authcode = sign(appKey, appSecret, reqTime, params)
    const res      = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({appKey, ...params, reqTime}),
    })
    const text = await res.text()
    let json: any = {}
    try { json = JSON.parse(text) } catch {}
    const code = json.code ?? json.status
    const ok   = code===200||code===0||code==='200'||code==='0'
    return { label, ok, httpStatus: res.status, code: json.code, message: json.message ?? json.msg ?? '',
      total: json.data?.total ?? json.data?.totalCount ?? (Array.isArray(json.data) ? json.data.length : '?'),
      sampleKeys: json.data ? (Array.isArray(json.data) ? Object.keys(json.data[0]??{}).slice(0,8) : Object.keys(json.data).slice(0,8)) : [],
      rawPreview: text.slice(0,400) }
  } catch(e:any) {
    return { label, ok:false, httpStatus:0, code:'ERR', message:e.message, total:0, sampleKeys:[], rawPreview:'' }
  }
}

export async function GET(_req: NextRequest) {
  const steps: any[] = []

  // 1. Env vars
  const encSecret = process.env.ENCRYPTION_SECRET
  steps.push({ step:'环境变量', ok: !!encSecret,
    detail: { ENCRYPTION_SECRET: encSecret ? `已设置(长度${encSecret.length})` : '❌ 未设置',
              DEFAULT_TENANT_ID: DEFAULT_TENANT } })

  // 2. DB read
  let appKey = '', appSecret = ''
  try {
    const supabase = getSupabaseAdminClient()
    const { data:cred, error } = await supabase.from('lingxing_credentials')
      .select('app_key,app_secret,auth_status,warehouse_ids').eq('tenant_id', DEFAULT_TENANT).single()
    if (error) throw new Error(`DB: ${error.message}`)
    if (!cred) throw new Error('数据库中找不到凭证')
    steps.push({ step:'数据库凭证', ok: cred.auth_status===1,
      detail: { auth_status: cred.auth_status, warehouse_ids: cred.warehouse_ids,
                app_key_encrypted_len: cred.app_key?.length, app_secret_encrypted_len: cred.app_secret?.length } })
    // 3. Decrypt
    appKey    = decrypt(cred.app_key)
    appSecret = decrypt(cred.app_secret)
    steps.push({ step:'解密凭证', ok: appKey.length>0 && appSecret.length>0,
      detail: { appKey_len: appKey.length, appSecret_len: appSecret.length,
                appKey_prefix: appKey.slice(0,6)+'…', ok: appKey.length>0 } })
  } catch(e:any) {
    steps.push({ step:'凭证读取/解密', ok:false, detail:{ error: e.message } })
    return NextResponse.json({ steps })
  }

  // 4. API probes
  const today = new Date().toISOString().split('T')[0]
  const start90 = new Date(Date.now()-90*864e5).toISOString().split('T')[0]
  const results = await Promise.all([
    probe(appKey, appSecret, '仓库列表',     '/v1/warehouse/options',           {}),
    probe(appKey, appSecret, '入库单',       '/v1/inboundOrder/pageList',       {page:1,pageSize:3,warehouseCode:'LIHO'}),
    probe(appKey, appSecret, '入库单(无wh)', '/v1/inboundOrder/pageList',       {page:1,pageSize:3}),
    probe(appKey, appSecret, '小包出库单',   '/v1/outboundOrder/pageList',      {page:1,pageSize:3,warehouseCode:'LIHO'}),
    probe(appKey, appSecret, '大货出库单',   '/v1/bigOutboundOrder/pageList',   {page:1,pageSize:3,warehouseCode:'LIHO'}),
    probe(appKey, appSecret, '退件单',       '/v1/returnOrder/pageList',        {page:1,pageSize:3,warehouseCode:'LIHO'}),
    probe(appKey, appSecret, '库存(type=1)', '/v1/integratedInventory/pageOpen',{page:1,pageSize:3,startTime:`${start90} 00:00:00`,endTime:`${today} 23:59:59`,inventoryType:1}),
    probe(appKey, appSecret, '库存(无参)',   '/v1/integratedInventory/pageOpen',{page:1,pageSize:3}),
    probe(appKey, appSecret, '客户列表',     '/v1/customer/pageList',           {page:1,pageSize:3}),
    probe(appKey, appSecret, '商品列表',     '/v1/product/pageList',            {page:1,pageSize:3}),
    probe(appKey, appSecret, '工单列表',     '/v1/workOrder/pageList',          {page:1,pageSize:3}),
    probe(appKey, appSecret, '库位列表',     '/v1/location/pageList',           {page:1,pageSize:3}),
  ])
  steps.push({ step:'API接口探测', ok: results.filter(r=>r.ok).length>0, detail: results })

  return NextResponse.json({ steps, timestamp: new Date().toISOString() })
}
