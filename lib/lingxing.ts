/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * 领星 OMS API 封装
 * Base URL: https://api.xlwms.com/openapi
 * 认证: Header 中带 appKey + appSecret
 * 文档: https://apidoc-oms.xlwms.com
 */

import { encrypt, decrypt } from './crypto'
import { getSupabaseAdminClient } from './supabase-server'

const API_BASE = 'https://api.xlwms.com/openapi'

// ── Credential row ────────────────────────────────────────────
export interface OmsCredential {
  tenant_id: string
  app_key: string       // encrypted
  app_secret: string    // encrypted
  auth_status: number
  last_sync_at?: string
  warehouse_ids?: string[]
}

// ── Core request ─────────────────────────────────────────────
async function omsRequest(
  appKey: string,
  appSecret: string,
  endpoint: string,
  body: Record<string, any> = {}
): Promise<any> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'appKey': appKey,
      'appSecret': appSecret,
    },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    throw new Error(`OMS HTTP ${res.status}: ${endpoint}`)
  }

  const json = await res.json()

  // OMS returns { code: 200, data: ... } or { code: 0, data: ... }
  const code = json.code ?? json.status
  if (code !== 200 && code !== 0 && code !== '200' && code !== '0') {
    throw new Error(`OMS API错误 [${endpoint}]: code=${code} msg=${json.message ?? json.msg ?? '未知'}`)
  }

  return json.data ?? json
}

// ── Paginated fetch ───────────────────────────────────────────
async function fetchAllPages(
  appKey: string,
  appSecret: string,
  endpoint: string,
  params: Record<string, any> = {}
): Promise<any[]> {
  const all: any[] = []
  let pageNo = 1
  const pageSize = 100

  while (true) {
    const data = await omsRequest(appKey, appSecret, endpoint, {
      ...params,
      pageNo,
      pageSize,
    })

    // OMS may return array directly or { list: [], total: N }
    const items: any[] = Array.isArray(data)
      ? data
      : (data?.list ?? data?.records ?? data?.data ?? [])

    all.push(...items)

    if (items.length < pageSize) break
    pageNo++
    await new Promise(r => setTimeout(r, 200)) // rate limit
  }

  return all
}

// ── Get decrypted keys for a tenant ──────────────────────────
async function getTenantKeys(tenantId: string): Promise<{ appKey: string; appSecret: string }> {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('lingxing_credentials')
    .select('app_key, app_secret, auth_status')
    .eq('tenant_id', tenantId)
    .single()

  if (error || !data) throw new Error(`租户 ${tenantId} 未找到凭证`)
  if (data.auth_status !== 1) throw new Error(`租户 ${tenantId} 凭证未激活 (status=${data.auth_status})`)

  return {
    appKey: decrypt(data.app_key),
    appSecret: decrypt(data.app_secret),
  }
}

// ── Verify & bind credentials ─────────────────────────────────
export async function verifyAndBind(
  tenantId: string,
  appKey: string,
  appSecret: string
): Promise<{ success: boolean; message: string; warehouseCount?: number }> {

  // ── Step 1: 检查 ENCRYPTION_SECRET ───────────────────────────
  const encSecret = process.env.ENCRYPTION_SECRET
  if (!encSecret || encSecret.length < 16) {
    return { success: false, message: '❌ 服务器配置错误：Vercel 环境变量缺少 ENCRYPTION_SECRET（需要32位字符串）' }
  }

  // ── Step 2: 检查 Supabase 连接 ────────────────────────────────
  const supabase = getSupabaseAdminClient()
  const { error: dbErr } = await supabase.from('tenants').select('id').limit(1)
  if (dbErr) {
    return { success: false, message: `❌ 数据库连接失败：${dbErr.message} — 请检查 Vercel 的 SUPABASE_SERVICE_ROLE_KEY / NEXT_PUBLIC_SUPABASE_URL` }
  }

  // ── Step 3: 检查 tenants 表里是否有默认租户 ──────────────────
  const { data: tenant } = await supabase.from('tenants').select('id').eq('id', tenantId).maybeSingle()
  if (!tenant) {
    // 自动插入默认租户
    const { error: insertErr } = await supabase.from('tenants').insert({ id: tenantId, name: '默认仓库' })
    if (insertErr) {
      return { success: false, message: `❌ 默认租户不存在且创建失败：${insertErr.message} — 请先在 Supabase 执行初始化 SQL` }
    }
  }

  // ── Step 4: 调用 OMS API 验证 AppKey/AppSecret ────────────────
  let omsError1 = ''
  try {
    const data = await omsRequest(appKey, appSecret, '/v1/warehouse/options', {})
    const warehouses: any[] = Array.isArray(data) ? data : (data?.list ?? data?.records ?? [])
    const warehouseIds = warehouses.map((w: any) => String(w.id ?? w.warehouseId ?? w.warehouse_id))

    const { error: upsertErr } = await supabase
      .from('lingxing_credentials')
      .upsert({
        tenant_id:     tenantId,
        app_key:       encrypt(appKey),
        app_secret:    encrypt(appSecret),
        warehouse_ids: warehouseIds,
        auth_status:   1,
        sync_enabled:  true,
      }, { onConflict: 'tenant_id' })

    if (upsertErr) {
      return { success: false, message: `❌ 凭证保存失败：${upsertErr.message}` }
    }

    return { success: true, message: `✅ 绑定成功！检测到 ${warehouses.length} 个仓库`, warehouseCount: warehouses.length }

  } catch (err) {
    omsError1 = err instanceof Error ? err.message : String(err)
  }

  // ── Step 5: 备用接口再试一次 ──────────────────────────────────
  try {
    await omsRequest(appKey, appSecret, '/v1/inboundOrder/pageList', { pageNo: 1, pageSize: 1 })

    const { error: upsertErr } = await supabase
      .from('lingxing_credentials')
      .upsert({
        tenant_id:    tenantId,
        app_key:      encrypt(appKey),
        app_secret:   encrypt(appSecret),
        auth_status:  1,
        sync_enabled: true,
      }, { onConflict: 'tenant_id' })

    if (upsertErr) {
      return { success: false, message: `❌ 凭证保存失败：${upsertErr.message}` }
    }

    return { success: true, message: '✅ 绑定成功！（仓库接口受限，但 API 验证通过）', warehouseCount: 0 }

  } catch (err) {
    const omsError2 = err instanceof Error ? err.message : String(err)
    return {
      success: false,
      message: `❌ OMS API 验证失败\n仓库接口：${omsError1}\n入库接口：${omsError2}`,
    }
  }
}

// ── Business data fetchers ────────────────────────────────────

/** 入库单列表 - 待入库 / 待上架 */
export async function fetchInboundOrders(tenantId: string, status?: number): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  const params: Record<string, any> = {}
  if (status !== undefined) params.status = status
  return fetchAllPages(appKey, appSecret, '/v1/inboundOrder/pageList', params)
}

/** 小包出库单（一件代发） */
export async function fetchOutboundOrders(tenantId: string, status?: number): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  const params: Record<string, any> = {}
  if (status !== undefined) params.status = status
  return fetchAllPages(appKey, appSecret, '/v1/outboundOrder/pageList', params)
}

/** 大货出库单（FBA备货） */
export async function fetchBigOutboundOrders(tenantId: string, status?: number): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  const params: Record<string, any> = {}
  if (status !== undefined) params.status = status
  return fetchAllPages(appKey, appSecret, '/v1/bigOutboundOrder/pageList', params)
}

/** 综合库存 */
export async function fetchInventory(tenantId: string): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  // requires time range - last 30 days
  const endTime   = new Date().toISOString().split('T')[0] + ' 23:59:59'
  const startTime = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0] + ' 00:00:00'
  return fetchAllPages(appKey, appSecret, '/v1/integratedInventory/pageOpen', {
    startTime,
    endTime,
    inventoryType: 1, // 1=产品库存(一件代发用)
  })
}

/** 退件单列表 */
export async function fetchReturnOrders(tenantId: string, status?: number): Promise<any[]> {
  const { appKey, appSecret } = await getTenantKeys(tenantId)
  const params: Record<string, any> = {}
  if (status !== undefined) params.status = status
  return fetchAllPages(appKey, appSecret, '/v1/returnOrder/pageList', params)
}

/** 仓库列表 */
export async function fetchWarehouses(appKey: string, appSecret: string): Promise<any[]> {
  const data = await omsRequest(appKey, appSecret, '/v1/warehouse/options', {})
  return Array.isArray(data) ? data : (data?.list ?? data?.records ?? [])
}
