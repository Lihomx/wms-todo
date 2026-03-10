/* eslint-disable @typescript-eslint/no-explicit-any */
import { encrypt, decrypt } from './crypto'
import { getSupabaseAdminClient } from './supabase-server'

const AUTH_URL = process.env.LINGXING_AUTH_URL || 'https://openapi.lingxing.com/erp/sc/auth/token'
const API_BASE = process.env.LINGXING_API_BASE_URL || 'https://openapi.lingxing.com'

// ── Credential row shape from DB ─────────────────────────────
interface CredRow {
  tenant_id: string
  app_key: string
  app_secret: string
  access_token: string
  refresh_token: string
  token_expire_at: string
  auth_status: number
  warehouse_ids: string[]
  sync_enabled: boolean
}

// ── Token management ─────────────────────────────────────────
export async function getValidToken(tenantId: string): Promise<string> {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase
    .from('lingxing_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  const cred = data as CredRow | null
  if (!cred || cred.auth_status !== 1) {
    throw new Error(`租户 ${tenantId} 未绑定领星账号或已过期`)
  }

  const expireAt = new Date(cred.token_expire_at).getTime()
  if (expireAt > Date.now() + 5 * 60 * 1000) {
    return decrypt(cred.access_token)
  }

  return refreshToken(tenantId, cred)
}

async function refreshToken(tenantId: string, cred: CredRow): Promise<string> {
  const supabase = getSupabaseAdminClient()
  try {
    const res  = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId:        decrypt(cred.app_key),
        appSecret:    decrypt(cred.app_secret),
        grantType:    'refresh_token',
        refreshToken: decrypt(cred.refresh_token),
      }),
    })
    const json = await res.json()
    if (json.code !== 0) throw new Error(`Token刷新失败: ${json.msg}`)

    const { access_token, refresh_token, expires_in } = json.data
    await supabase.from('lingxing_credentials').update({
      access_token:    encrypt(access_token),
      refresh_token:   encrypt(refresh_token),
      token_expire_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      auth_status:     1,
    }).eq('tenant_id', tenantId)

    return access_token as string
  } catch (err) {
    await supabase.from('lingxing_credentials').update({ auth_status: 2 }).eq('tenant_id', tenantId)
    throw err
  }
}

// ── Generic API call ─────────────────────────────────────────
async function callAPI(token: string, endpoint: string, body: Record<string, any> = {}): Promise<any> {
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(`[${endpoint}] ${json.msg}`)
  return json.data
}

// Auto-paginate
async function fetchAll(token: string, endpoint: string, params: Record<string, any> = {}): Promise<any[]> {
  const all: any[] = []
  let offset = 0
  while (true) {
    const data  = await callAPI(token, endpoint, { ...params, offset, length: 100 })
    const items = Array.isArray(data) ? data : (data?.list ?? [])
    all.push(...items)
    if (items.length < 100) break
    offset += 100
    await new Promise(r => setTimeout(r, 200))
  }
  return all
}

// ── Public API functions ─────────────────────────────────────
export function fetchPendingInbound(token: string)   { return fetchAll(token, '/erp/wms/inbound/lists',  { status: 1 }) }
export function fetchReceivedInbound(token: string)  { return fetchAll(token, '/erp/wms/inbound/lists',  { status: 3 }) }
export function fetchPendingOutbound(token: string)  { return fetchAll(token, '/erp/wms/outbound/lists', { order_type: 1, status: 1 }) }
export function fetchTodayOutbound(token: string) {
  const today = new Date().toISOString().split('T')[0]
  return fetchAll(token, '/erp/wms/outbound/lists', { start_date: today, end_date: today })
}
export function fetchInventory(token: string)        { return fetchAll(token, '/erp/wms/inventory/lists',  {}) }
export function fetchReturns(token: string)          { return fetchAll(token, '/erp/wms/return/lists',     { status: 1 }) }
export function fetchWorkOrders(token: string)       { return fetchAll(token, '/erp/wms/workorder/lists',  { status: 1 }) }

// ── Bind / verify credentials ────────────────────────────────
export async function verifyAndBind(
  tenantId: string,
  appKey: string,
  appSecret: string
): Promise<{ success: boolean; message: string; warehouseCount?: number }> {
  const supabase = getSupabaseAdminClient()
  try {
    const res  = await fetch(AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appId: appKey, appSecret, grantType: 'client_credentials' }),
    })
    const json = await res.json()
    if (json.code !== 0 || !json.data?.access_token) {
      return { success: false, message: `授权失败: ${json.msg}（请检查 AppKey / AppSecret）` }
    }

    const { access_token, refresh_token, expires_in } = json.data

    // Test: fetch warehouse list
    let warehouseCount = 0
    let warehouseIds: string[] = []
    try {
      const wRes  = await fetch(`${API_BASE}/erp/wms/warehouse/lists`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${access_token}` },
        body: JSON.stringify({ offset: 0, length: 100 }),
      })
      const wJson = await wRes.json()
      const wList = Array.isArray(wJson.data) ? wJson.data : []
      warehouseCount = wList.length
      warehouseIds   = wList.map((w: any) => String(w.id))
    } catch { /* warehouse list optional */ }

    await supabase.from('lingxing_credentials').upsert({
      tenant_id:       tenantId,
      app_key:         encrypt(appKey),
      app_secret:      encrypt(appSecret),
      access_token:    encrypt(access_token),
      refresh_token:   encrypt(refresh_token),
      token_expire_at: new Date(Date.now() + expires_in * 1000).toISOString(),
      warehouse_ids:   warehouseIds,
      auth_status:     1,
      sync_enabled:    true,
    }, { onConflict: 'tenant_id' })

    return { success: true, message: `绑定成功！检测到 ${warehouseCount} 个仓库`, warehouseCount }
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return { success: false, message: `绑定失败: ${msg}` }
  }
}
