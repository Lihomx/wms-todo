/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { decrypt } from '@/lib/crypto'
import { createHmac } from 'crypto'

const API_BASE = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

// 签名算法：appKey + sorted(业务参数values) + reqTime
function sign(appKey: string, appSecret: string, reqTime: string, data: Record<string,any>): string {
  const v = Object.entries(data)
    .map(([k,v]) => [k.toLowerCase(), v] as [string,any])
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([,v]) => String(v)).join('')
  return createHmac('sha256', appSecret).update(appKey + v + reqTime).digest('hex')
}

async function callAndLog(appKey: string, appSecret: string, endpoint: string, data: Record<string,any>={}) {
  const reqTime  = String(Math.floor(Date.now()/1000))
  const authcode = sign(appKey, appSecret, reqTime, data)
  const url      = `${API_BASE}${endpoint}?authcode=${authcode}`
  const bodyObj  = { appKey, ...data, reqTime }

  // 签名原串（用于调试）
  const sortedValues = Object.entries(data)
    .map(([k,v]) => [k.toLowerCase(), v] as [string,any])
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([,v]) => String(v)).join('')
  const strToSign = appKey + sortedValues + reqTime

  let responseCode: any = null
  let responseMsg  = ''
  let responseRaw  = ''
  let httpStatus   = 0

  try {
    const res  = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj),
      signal: AbortSignal.timeout(10000),
    })
    httpStatus   = res.status
    responseRaw  = await res.text()
    let json: any = {}
    try { json = JSON.parse(responseRaw) } catch { /**/ }
    responseCode = json.code ?? json.status
    responseMsg  = json.message ?? json.msg ?? ''
  } catch(e:any) {
    responseMsg = e.message
  }

  const ok = responseCode===200||responseCode===0||responseCode==='200'||responseCode==='0'
  return {
    endpoint,
    url,
    requestBody:    bodyObj,
    strToSign,
    authcode,
    httpStatus,
    responseCode,
    responseMsg,
    responseRaw:    responseRaw.slice(0, 600),
    ok,
  }
}

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseAdminClient()
  const { data: cred, error } = await supabase
    .from('lingxing_credentials')
    .select('app_key,app_secret,auth_status,warehouse_ids')
    .eq('tenant_id', DEFAULT_TENANT)
    .single()

  if (error || !cred) return NextResponse.json({ error: `DB: ${error?.message ?? '无凭证'}` })

  const appKey    = decrypt(cred.app_key)
  const appSecret = decrypt(cred.app_secret)
  const today = new Date().toISOString().split('T')[0]
  const start90 = new Date(Date.now()-90*864e5).toISOString().split('T')[0]

  // 每个接口只发一次请求，完整记录请求体和响应
  const results = await Promise.all([
    callAndLog(appKey, appSecret, '/v1/warehouse/options',           {}),
    callAndLog(appKey, appSecret, '/v1/inboundOrder/pageList',       { page:1, pageSize:10 }),
    callAndLog(appKey, appSecret, '/v1/outboundOrder/pageList',      { page:1, pageSize:10 }),
    callAndLog(appKey, appSecret, '/v1/bigOutboundOrder/pageList',   { page:1, pageSize:10 }),
    callAndLog(appKey, appSecret, '/v1/returnOrder/pageList',        { page:1, pageSize:10 }),
    callAndLog(appKey, appSecret, '/v1/integratedInventory/pageOpen',{ page:1, pageSize:10, inventoryType:1, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` }),
  ])

  return NextResponse.json({ 
    appKeyPreview: appKey.slice(0,8)+'...',
    results,
    timestamp: new Date().toISOString()
  }, { headers: { 'Content-Type': 'application/json; charset=utf-8' }})
}
