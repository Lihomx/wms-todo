/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { decrypt, encrypt } from '@/lib/crypto'
import { createHmac } from 'crypto'

const API_BASE = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

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
  const bodyObj  = { appKey, ...data, reqTime }
  const sortedValues = Object.entries(data)
    .map(([k,v]) => [k.toLowerCase(), v] as [string,any])
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([,v]) => String(v)).join('')
  const strToSign = appKey + sortedValues + reqTime

  try {
    const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(bodyObj), signal: AbortSignal.timeout(10000),
    })
    const raw  = await res.text()
    let json: any = {}
    try { json = JSON.parse(raw) } catch { /**/ }
    const code = json.code ?? json.status
    const ok   = code===200||code===0||code==='200'||code==='0'
    return { endpoint, requestBody: bodyObj, strToSign, authcode, httpStatus: res.status, responseCode: code, responseMsg: json.message??json.msg??'', responseRaw: raw.slice(0,400), ok }
  } catch(e:any) {
    return { endpoint, requestBody: bodyObj, strToSign, authcode, httpStatus: 0, responseCode: 'ERR', responseMsg: e.message, responseRaw: '', ok: false }
  }
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const supabase = getSupabaseAdminClient()

  // ── Step 1: 读取 DB 原始加密值 ──────────────────────────────
  const { data: cred, error } = await supabase
    .from('lingxing_credentials')
    .select('app_key,app_secret,auth_status,warehouse_ids')
    .eq('tenant_id', DEFAULT_TENANT)
    .single()

  if (error || !cred) return NextResponse.json({ error: `DB: ${error?.message ?? '无凭证'}` })

  const encSecret = process.env.ENCRYPTION_SECRET ?? ''

  // ── Step 2: 尝试解密 ──────────────────────────────────────
  let appKey = '', appSecret = ''
  let decryptOk = false
  try {
    appKey    = decrypt(cred.app_key)
    appSecret = decrypt(cred.app_secret)
    decryptOk = appKey.length > 0 && appSecret.length > 0
  } catch(e:any) {
    return NextResponse.json({
      error: `解密失败: ${e.message}`,
      hint: 'ENCRYPTION_SECRET 与绑定时不一致',
      encSecretLen: encSecret.length,
      storedAppKeyLen: cred.app_key?.length,
    })
  }

  // ── Step 3: 如果解密出来是空，用已知明文凭证直接重新存入 ──
  // (用于修复解密为空的情况)
  const forceRebind = searchParams.get('rebind')
  const rawAppKey    = searchParams.get('ak')
  const rawAppSecret = searchParams.get('as')

  if (forceRebind && rawAppKey && rawAppSecret) {
    const { error: upsertErr } = await supabase
      .from('lingxing_credentials')
      .upsert({
        tenant_id:     DEFAULT_TENANT,
        app_key:       encrypt(rawAppKey),
        app_secret:    encrypt(rawAppSecret),
        warehouse_ids: ['LIHO'],
        auth_status:   1,
        sync_enabled:  true,
      }, { onConflict: 'tenant_id' })
    if (upsertErr) return NextResponse.json({ error: `重新保存失败: ${upsertErr.message}` })
    // 验证新凭证
    const verifyResult = await callAndLog(rawAppKey, rawAppSecret, '/v1/warehouse/options', {})
    return NextResponse.json({ rebind: 'success', verify: verifyResult })
  }

  const diagnostics = {
    encSecretLen:    encSecret.length,
    encSecretPrefix: encSecret.slice(0,4) + '...',
    storedAppKeyEncryptedLen: cred.app_key?.length,
    decryptedAppKeyLen:  appKey.length,
    decryptedAppKeyEmpty: appKey.length === 0,
    decryptOk,
    authStatus: cred.auth_status,
  }

  if (!decryptOk) {
    return NextResponse.json({
      diagnostics,
      error: '解密后 appKey 为空！ENCRYPTION_SECRET 与绑定时使用的不一致',
      fix: `请访问 /api/lingxing/debug?rebind=1&ak=YOUR_APPKEY&as=YOUR_APPSECRET 重新写入凭证`,
    })
  }

  // ── Step 4: 正常调用 ─────────────────────────────────────
  const today  = new Date().toISOString().split('T')[0]
  const start90 = new Date(Date.now()-90*864e5).toISOString().split('T')[0]

  const results = await Promise.all([
    callAndLog(appKey, appSecret, '/v1/warehouse/options', {}),
    callAndLog(appKey, appSecret, '/v1/inboundOrder/pageList', { page:1, pageSize:10 }),
    callAndLog(appKey, appSecret, '/v1/outboundOrder/pageList', { page:1, pageSize:10 }),
    callAndLog(appKey, appSecret, '/v1/returnOrder/pageList', { page:1, pageSize:10 }),
    callAndLog(appKey, appSecret, '/v1/integratedInventory/pageOpen', { page:1, pageSize:10, inventoryType:1, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` }),
  ])

  return NextResponse.json({ diagnostics, results, timestamp: new Date().toISOString() })
}
