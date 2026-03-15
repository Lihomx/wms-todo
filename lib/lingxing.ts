/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 领星 OMS API 封装 (V2协议)
 * Base URL: https://api.xlwms.com/openapi
 * 文档: https://apidoc-oms.xlwms.com
 *
 * V2 请求格式：
 *   POST /endpoint?authcode=xxx
 *   Body: { appKey, reqTime, data: { ...业务参数 } }
 *
 * V2 签名算法：
 *   1. 业务参数 key 转小写，与 appKey/reqTime 合并
 *   2. 所有 key 按字典序排序
 *   3. 拼接 value：appKey/reqTime 不加引号，业务字符串值加双引号，数字不加
 *   4. authcode = HmacSHA256(appSecret, 拼接串)，hex小写
 */

import { encrypt, decrypt } from './crypto'
import { getSupabaseAdminClient } from './supabase-server'
import { createHmac } from 'crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

// ── V2 签名 ───────────────────────────────────────────────────
export function generateAuthcodeV2(
  appKey: string,
  appSecret: string,
  reqTime: string,
  data: Record<string, any>
): string {
  // data 的 key 转小写合并，appKey/reqTime 保持原key不转小写
  const params: Record<string, any> = { appKey, reqTime }
  for (const [k, v] of Object.entries(data)) {
    params[k.toLowerCase()] = v
  }

  const sorted = Object.entries(params).sort(([a], [b]) => a.localeCompare(b))

  // appKey 和 reqTime 值不加引号，其他字符串值加双引号，数字直接转字符串
  const strToSign = sorted
    .map(([k, v]) => {
      if (k === 'appKey' || k === 'reqTime') return String(v)
      return typeof v === 'string' ? `"${v}"` : String(v)
    })
    .join('')

  return createHmac('sha256', appSecret).update(strToSign).digest('hex')
}

// ── V2 请求 ───────────────────────────────────────────────────
async function omsRequest(
  appKey: string,
  appSecret: string,
  endpoint: string,
  data: Record<string, any> = {}
): Promise<any> {
  const reqTime  = String(Math.floor(Date.now() / 1000))
  const authcode = generateAuthcodeV2(appKey, appSecret, reqTime, data)

  // V2: 业务参数放在 data 字段，不展开到顶层
  const body = { appKey, reqTime, data }

  const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(body),
  })

  if (!res.ok) throw new Error(`HTTP ${res.status}: ${endpoint}`)

  const json = await res.json()
  const code = json.code ?? json.status

  if (code !== 200 && code !== 0 && code !== '200' && code !== '0') {
    throw new Error(`OMS code=${code} msg=${json.message ?? json.msg ?? ''}`)
  }

  return json.data ?? json
}

// ── 分页拉取所有数据 ──────────────────────────────────────────
async function fetchAllPages(
  appKey: string,
  appSecret: string,
  endpoint: string,
  params: Record<string, any> = {}
): Promise<any[]> {
  const all: any[] = []
  let page = 1
  while (true) {
    const data = await omsRequest(appKey, appSecret, endpoint, { ...params, page, pageSize: 50 })
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

// ── 获取租户凭证 ──────────────────────────────────────────────
async function getTenantKeys(tenantId: string): Promise<{ appKey: string; appSecret: string }> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('lingxing_credentials')
    .select('app_key, app_secret, auth_status')
    .eq('tenant_id', tenantId)
    .single()
  if (error || !data) throw new Error(`租户 ${tenantId} 未找到凭证`)
  if (data.auth_status !== 1) throw new Error(`凭证未激活 (status=${data.auth_status})`)
  return { appKey: decrypt(data.app_key), appSecret: decrypt(data.app_secret) }
}

// ── 验证并绑定 ────────────────────────────────────────────────
export async function verifyAndBind(
  tenantId: string,
  appKey: string,
  appSecret: string
): Promise<{ success: boolean; message: string; warehouseCount?: number }> {
  if (!process.env.ENCRYPTION_SECRET || process.env.ENCRYPTION_SECRET.length < 16) {
    return { success: false, message: '❌ 服务器配置错误：缺少 ENCRYPTION_SECRET' }
  }

  const supabase = getSupabaseAdminClient()

  // 自动创建默认租户
  const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle()
  if (!tenant) {
    await supabase.from('tenants').insert({ id: tenantId, name: '默认仓库' })
  }

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

// ── 业务数据接口 ──────────────────────────────────────────────
export async function fetchInboundOrders(tenantId: string): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  return fetchAllPages(appKey, appSecret, '/v1/inboundOrder/pageList', {})
}

export async function fetchOutboundOrders(tenantId: string): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  return fetchAllPages(appKey, appSecret, '/v1/outboundOrder/pageList', {})
}

export async function fetchBigOutboundOrders(tenantId: string): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  return fetchAllPages(appKey, appSecret, '/v1/bigOutboundOrder/pageList', {})
}

export async function fetchReturnOrders(tenantId: string): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  return fetchAllPages(appKey, appSecret, '/v1/returnOrder/pageList', {})
}

export async function fetchInventory(tenantId: string): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  const today = new Date().toISOString().split('T')[0]
  const start = new Date(Date.now() - 90 * 864e5).toISOString().split('T')[0]
  return fetchAllPages(appKey, appSecret, '/v1/integratedInventory/pageOpen', {
    inventoryType: 1,
    startTime: `${start} 00:00:00`,
    endTime:   `${today} 23:59:59`,
  })
}

export async function fetchWarehouses(appKey: string, appSecret: string): Promise<any[]> {
  const data = await omsRequest(appKey, appSecret, '/v1/warehouse/options', {})
  return Array.isArray(data) ? data : (data?.list ?? [])
}
