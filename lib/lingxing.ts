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

// ── Token cache (in-memory, per process) ─────────────────────
const tokenCache: Record<string, { authcode: string; expiresAt: number }> = {}

// 领星OMS token 获取接口（尝试多个可能的路径）
async function getAuthcode(appKey: string, appSecret: string): Promise<string> {
  const cached = tokenCache[appKey]
  if (cached && cached.expiresAt > Date.now() + 60_000) return cached.authcode

  const candidates = [
    `${API_BASE}/v1/auth/token`,
    `${API_BASE}/v1/auth/getToken`,
    `${API_BASE}/auth/token`,
    `${API_BASE}/v1/open/auth/token`,
  ]

  let lastError = ''
  for (const url of candidates) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey, appSecret }),
      })
      const json = await res.json()
      const code = json.code ?? json.status
      const token = json.data?.authcode ?? json.data?.token ?? json.data?.accessToken ?? json.data?.access_token
      if ((code === 200 || code === 0 || code === '200' || code === '0') && token) {
        const ttl = (json.data?.expiresIn ?? json.data?.expire ?? json.data?.expires_in ?? 7200) * 1000
        tokenCache[appKey] = { authcode: token, expiresAt: Date.now() + ttl }
        return token
      }
      lastError = `[${url}] code=${code} msg=${json.message ?? json.msg ?? JSON.stringify(json).slice(0, 100)}`
    } catch (e) {
      lastError = `[${url}] ${e instanceof Error ? e.message : String(e)}`
    }
  }
  throw new Error(`获取 OMS Token 失败。尝试了以下接口均无效：${lastError}`)
}

// ── Core request ─────────────────────────────────────────────
async function omsRequest(
  appKey: string,
  appSecret: string,
  endpoint: string,
  body: Record<string, any> = {}
): Promise<any> {
  const authcode = await getAuthcode(appKey, appSecret)

  const doRequest = async (code: string) => fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ...body, authcode: code }),
  })

  let res = await doRequest(authcode)
  if (!res.ok) throw new Error(`OMS HTTP ${res.status}: ${endpoint}`)

  let json = await res.json()
  let responseCode = json.code ?? json.status

  // authcode 过期 → 清缓存重试一次
  if (responseCode === 11001 || responseCode === '11001') {
    delete tokenCache[appKey]
    const fresh = await getAuthcode(appKey, appSecret)
    res = await doRequest(fresh)
    if (!res.ok) throw new Error(`OMS HTTP ${res.status}: ${endpoint}`)
    json = await res.json()
    responseCode = json.code ?? json.status
  }

  if (responseCode !== 200 && responseCode !== 0 && responseCode !== '200' && responseCode !== '0') {
    throw new Error(`OMS API错误 [${endpoint}]: code=${responseCode} msg=${json.message ?? json.msg ?? '未知'}`)
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
