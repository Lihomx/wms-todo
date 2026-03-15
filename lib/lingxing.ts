/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 领星 OMS API 封装（已与官方文档核对）
 *
 * 请求格式：
 *   POST /endpoint?authcode=xxx
 *   Body（有业务参数）: { "appKey":"...", "data":{...业务参数}, "reqTime":"..." }
 *   Body（无业务参数）: { "appKey":"...", "reqTime":"..." }
 *
 * 签名算法（appKey + sorted_data_json + reqTime）：
 *   1. data 业务参数按 key 字典序（不分大小写）升序排列
 *   2. 序列化为 JSON 字符串
 *   3. strToSign = appKey + dataJson + reqTime
 *      （无业务参数时：strToSign = appKey + reqTime）
 *   4. authcode = HmacSHA256(appSecret, strToSign)，hex小写
 *
 * 官方示例验证：
 *   data={current:1,outboundOrderNos:"OB...",size:10}
 *   strToSign = appKey + '{"current":1,"outboundOrderNos":"OB...","size":10}' + reqTime  ✓
 */
import { encrypt, decrypt } from './crypto'
import { getSupabaseAdminClient } from './supabase-server'
import { createHmac } from 'crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

// ── 签名 ──────────────────────────────────────────────────────
export function generateAuthcode(
  appKey: string,
  appSecret: string,
  reqTime: string,
  data: Record<string, any>
): string {
  let strToSign: string
  if (Object.keys(data).length === 0) {
    // 无业务参数：不包含 data 字段
    strToSign = appKey + reqTime
  } else {
    // 有业务参数：data 按 key 字典序排序后序列化为 JSON
    const sortedData = Object.fromEntries(
      Object.entries(data).sort(([a], [b]) => a.toLowerCase().localeCompare(b.toLowerCase()))
    )
    strToSign = appKey + JSON.stringify(sortedData) + reqTime
  }
  return createHmac('sha256', appSecret).update(strToSign).digest('hex')
}

// ── 请求 ─────────────────────────────────────────────────────
async function omsRequest(
  appKey: string,
  appSecret: string,
  endpoint: string,
  data: Record<string, any> = {}
): Promise<any> {
  const reqTime  = String(Math.floor(Date.now() / 1000))
  const authcode = generateAuthcode(appKey, appSecret, reqTime, data)

  // 有业务参数时放在 data 字段，无参数时不包含 data 字段
  const body = Object.keys(data).length > 0
    ? { appKey, data, reqTime }
    : { appKey, reqTime }

  const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`HTTP ${res.status}`)
  const json = await res.json()
  const code = json.code ?? json.status
  if (code !== 200 && code !== 0 && code !== '200' && code !== '0')
    throw new Error(`OMS code=${code} msg=${json.message ?? json.msg ?? ''}`)
  return json.data ?? json
}

// ── 分页拉取 ─────────────────────────────────────────────────
async function fetchAllPages(
  appKey: string,
  appSecret: string,
  endpoint: string,
  params: Record<string, any> = {}
): Promise<any[]> {
  const all: any[] = []
  let page = 1
  while (true) {
    const data  = await omsRequest(appKey, appSecret, endpoint, { ...params, page, pageSize: 50 })
    const items: any[] = Array.isArray(data) ? data : (data?.list ?? data?.records ?? data?.rows ?? [])
    all.push(...items)
    const total = data?.total ?? data?.totalCount ?? null
    if (items.length < 50) break
    if (total !== null && all.length >= Number(total)) break
    page++
    await new Promise(r => setTimeout(r, 300))
  }
  return all
}

// ── 获取租户凭证 ─────────────────────────────────────────────
async function getTenantKeys(tenantId: string) {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('lingxing_credentials').select('app_key,app_secret,auth_status').eq('tenant_id', tenantId).single()
  if (error || !data) throw new Error(`租户 ${tenantId} 未找到凭证`)
  if (data.auth_status !== 1) throw new Error('凭证未激活')
  return { appKey: decrypt(data.app_key), appSecret: decrypt(data.app_secret) }
}

// ── 验证并绑定 ────────────────────────────────────────────────
export async function verifyAndBind(
  tenantId: string, appKey: string, appSecret: string
): Promise<{ success: boolean; message: string; warehouseCount?: number }> {
  if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET.length < 16)
    return { success: false, message: '❌ 缺少 ENCRYPTION_SECRET 环境变量' }
  const supabase = getSupabaseAdminClient()
  const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle()
  if (!tenant) await supabase.from('tenants').insert({ id: tenantId, name: '默认仓库' })
  try {
    const rawData = await omsRequest(appKey, appSecret, '/v1/warehouse/options', {})
    const warehouses: any[] = Array.isArray(rawData) ? rawData : (rawData?.list ?? [])
    const warehouseIds = warehouses.map((w: any) => String(w.whCode ?? w.id ?? ''))
    await supabase.from('lingxing_credentials').upsert({
      tenant_id: tenantId, app_key: encrypt(appKey), app_secret: encrypt(appSecret),
      warehouse_ids: warehouseIds, auth_status: 1, sync_enabled: true,
    }, { onConflict: 'tenant_id' })
    return { success: true, message: `✅ 绑定成功！检测到 ${warehouses.length} 个仓库`, warehouseCount: warehouses.length }
  } catch (err: any) {
    return { success: false, message: `❌ OMS验证失败: ${err.message}` }
  }
}

// ── 业务接口 ─────────────────────────────────────────────────
export async function fetchInboundOrders(tenantId: string) {
  const k = await getTenantKeys(tenantId)
  return fetchAllPages(k.appKey, k.appSecret, '/v1/inboundOrder/pageList', {})
}
export async function fetchOutboundOrders(tenantId: string) {
  const k = await getTenantKeys(tenantId)
  return fetchAllPages(k.appKey, k.appSecret, '/v1/outboundOrder/pageList', {})
}
export async function fetchBigOutboundOrders(tenantId: string) {
  const k = await getTenantKeys(tenantId)
  return fetchAllPages(k.appKey, k.appSecret, '/v1/bigOutboundOrder/pageList', {})
}
export async function fetchReturnOrders(tenantId: string) {
  const k = await getTenantKeys(tenantId)
  return fetchAllPages(k.appKey, k.appSecret, '/v1/returnOrder/pageList', {})
}
export async function fetchInventory(tenantId: string) {
  const k = await getTenantKeys(tenantId)
  const today = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0]
  return fetchAllPages(k.appKey, k.appSecret, '/v1/integratedInventory/pageOpen', {
    startTime: `${start} 00:00:00`, endTime: `${today} 23:59:59`
  })
}
export async function fetchWarehouses(appKey: string, appSecret: string) {
  const data = await omsRequest(appKey, appSecret, '/v1/warehouse/options', {})
  return Array.isArray(data) ? data : (data?.list ?? [])
}
