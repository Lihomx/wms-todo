// lib/lingxing.ts
// 领星 API 完整封装
// API文档：https://apidoc-oms.xlwms.com

import CryptoJS from 'crypto-js'
import { getSupabaseAdminClient } from './supabase'

const LINGXING_AUTH_URL = process.env.LINGXING_AUTH_URL || 'https://openapi.lingxing.com/erp/sc/auth/token'
const LINGXING_API_BASE = process.env.LINGXING_API_BASE_URL || 'https://openapi.lingxing.com'
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET!

// ── 加解密工具 ────────────────────────────────────────────────
export const encrypt = (text: string): string => {
  return CryptoJS.AES.encrypt(text, ENCRYPTION_SECRET).toString()
}

export const decrypt = (ciphertext: string): string => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_SECRET)
  return bytes.toString(CryptoJS.enc.Utf8)
}

// ── 领星 API 响应类型 ─────────────────────────────────────────
interface LingxingTokenResponse {
  code: number
  msg: string
  data: {
    access_token: string
    refresh_token: string
    expires_in: number   // 秒
  }
}

interface LingxingApiResponse<T = unknown> {
  code: number
  msg: string
  data: T
  total?: number
}

// 入库单
export interface InboundOrder {
  order_no: string           // 入库单号
  status: number             // 状态：1待入库 2收货中 3已收货 4已上架
  status_name: string
  warehouse_id: string
  warehouse_name: string
  expected_arrival_date: string
  actual_arrival_date?: string
  sku_count: number          // SKU种类数
  total_qty: number          // 总件数
  received_qty: number       // 已收货件数
  shelved_qty: number        // 已上架件数
  remark?: string
  created_at: string
  products: InboundProduct[]
}

export interface InboundProduct {
  sku: string
  sku_name: string
  expected_qty: number
  received_qty: number
  shelved_qty: number
}

// 出库单（一件代发/送仓/中转）
export interface OutboundOrder {
  order_no: string
  order_type: number         // 1一件代发 2送仓出库 3中转出库 4FBA出库
  order_type_name: string
  status: number             // 1待处理 2处理中 3已发货 4已取消
  status_name: string
  warehouse_id: string
  warehouse_name: string
  platform: string           // 平台：amazon/walmart/shopify
  buyer_name?: string
  tracking_no?: string
  created_at: string
  shipped_at?: string
  products: OutboundProduct[]
}

export interface OutboundProduct {
  sku: string
  sku_name: string
  qty: number
  shipped_qty: number
}

// 库存
export interface InventoryItem {
  sku: string
  sku_name: string
  warehouse_id: string
  warehouse_name: string
  available_qty: number      // 可用库存
  locked_qty: number         // 锁定库存
  total_qty: number          // 总库存
  return_qty: number         // 退货库存
  updated_at: string
}

// 退件单
export interface ReturnOrder {
  return_no: string
  status: number             // 1待处理 2质检中 3已入库 4已完成
  status_name: string
  warehouse_id: string
  platform: string
  original_order_no: string
  fnsku?: string
  sku?: string
  qty: number
  condition: string          // 良品/次品/残次品
  remark?: string
  created_at: string
}

// 工单
export interface WorkOrder {
  work_order_no: string
  order_type: string
  status: number             // 1待审核 2审核中 3已完成 4已拒绝
  status_name: string
  title: string
  description: string
  created_at: string
}

// ── Token 管理 ────────────────────────────────────────────────
const supabase = getSupabaseAdminClient()

export async function getValidToken(tenantId: string): Promise<string> {
  const { data: cred } = await supabase
    .from('lingxing_credentials')
    .select('*')
    .eq('tenant_id', tenantId)
    .single()

  if (!cred || cred.auth_status !== 1) {
    throw new Error(`租户 ${tenantId} 未绑定领星账号或已过期`)
  }

  // Token 有效期还有 5 分钟以上，直接返回
  const expireAt = new Date(cred.token_expire_at).getTime()
  if (expireAt > Date.now() + 5 * 60 * 1000) {
    return decrypt(cred.access_token)
  }

  // Token 快过期，使用 refresh_token 刷新
  return await refreshAccessToken(tenantId, cred)
}

async function refreshAccessToken(tenantId: string, cred: Record<string, string>): Promise<string> {
  try {
    const appKey = decrypt(cred.app_key)
    const appSecret = decrypt(cred.app_secret)

    const res = await fetch(LINGXING_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appKey,
        appSecret: appSecret,
        grantType: 'refresh_token',
        refreshToken: decrypt(cred.refresh_token),
      }),
    })

    const json: LingxingTokenResponse = await res.json()

    if (json.code !== 0 || !json.data?.access_token) {
      throw new Error(`Token刷新失败: ${json.msg}`)
    }

    const { access_token, refresh_token, expires_in } = json.data

    await supabase
      .from('lingxing_credentials')
      .update({
        access_token:    encrypt(access_token),
        refresh_token:   encrypt(refresh_token),
        token_expire_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        auth_status:     1,
      })
      .eq('tenant_id', tenantId)

    return access_token
  } catch (err) {
    // 刷新失败，标记为过期
    await supabase
      .from('lingxing_credentials')
      .update({ auth_status: 2 })
      .eq('tenant_id', tenantId)

    throw err
  }
}

// ── 通用 API 请求封装 ─────────────────────────────────────────
async function callLingxingAPI<T>(
  token: string,
  endpoint: string,
  params: Record<string, unknown> = {},
  method: 'GET' | 'POST' = 'POST'
): Promise<LingxingApiResponse<T>> {
  const url = `${LINGXING_API_BASE}${endpoint}`

  const res = await fetch(url, {
    method,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: method === 'POST' ? JSON.stringify(params) : undefined,
  })

  if (!res.ok) {
    throw new Error(`领星API请求失败: ${res.status} ${res.statusText}`)
  }

  const json = await res.json()

  if (json.code !== 0) {
    throw new Error(`领星API错误 [${json.code}]: ${json.msg}`)
  }

  return json
}

// ── 分页拉取所有数据（自动翻页） ──────────────────────────────
async function fetchAllPages<T>(
  token: string,
  endpoint: string,
  params: Record<string, unknown> = {},
  pageSize = 100
): Promise<T[]> {
  const allData: T[] = []
  let offset = 0

  while (true) {
    const res = await callLingxingAPI<T[]>(token, endpoint, {
      ...params,
      offset,
      length: pageSize,
    })

    const items = Array.isArray(res.data) ? res.data : []
    allData.push(...items)

    if (items.length < pageSize) break  // 最后一页
    offset += pageSize

    // 避免触发限流，加小延迟
    await sleep(200)
  }

  return allData
}

const sleep = (ms: number) => new Promise(r => setTimeout(r, ms))

// ── 入库单接口 ────────────────────────────────────────────────
export async function fetchInboundOrders(
  token: string,
  warehouseId?: string,
  dateFrom?: string,
  dateTo?: string
): Promise<InboundOrder[]> {
  return fetchAllPages<InboundOrder>(token, '/erp/wms/inbound/lists', {
    warehouse_id: warehouseId,
    start_date: dateFrom || getDateDaysAgo(30),
    end_date: dateTo || getTodayStr(),
  })
}

// 待入库（已预报未到货）
export async function fetchPendingInbound(token: string, warehouseId?: string) {
  return fetchAllPages<InboundOrder>(token, '/erp/wms/inbound/lists', {
    warehouse_id: warehouseId,
    status: 1,  // 1=待入库
  })
}

// 已收货待上架
export async function fetchReceivedPendingShelve(token: string, warehouseId?: string) {
  return fetchAllPages<InboundOrder>(token, '/erp/wms/inbound/lists', {
    warehouse_id: warehouseId,
    status: 3,  // 3=已收货（待上架）
  })
}

// ── 出库单接口 ────────────────────────────────────────────────
export async function fetchOutboundOrders(
  token: string,
  options: {
    warehouseId?: string
    orderType?: number    // 1一件代发 2送仓 3中转 4FBA
    status?: number       // 1待处理 2处理中 3已发货
    dateFrom?: string
    dateTo?: string
  } = {}
): Promise<OutboundOrder[]> {
  return fetchAllPages<OutboundOrder>(token, '/erp/wms/outbound/lists', {
    warehouse_id: options.warehouseId,
    order_type: options.orderType,
    status: options.status,
    start_date: options.dateFrom || getDateDaysAgo(7),
    end_date: options.dateTo || getTodayStr(),
  })
}

// 待处理出库单（一件代发）
export async function fetchPendingDropshipping(token: string, warehouseId?: string) {
  return fetchAllPages<OutboundOrder>(token, '/erp/wms/outbound/lists', {
    warehouse_id: warehouseId,
    order_type: 1,   // 一件代发
    status: 1,       // 待处理
  })
}

// 每日出库汇总（今天）
export async function fetchTodayOutbound(token: string, warehouseId?: string) {
  const today = getTodayStr()
  return fetchAllPages<OutboundOrder>(token, '/erp/wms/outbound/lists', {
    warehouse_id: warehouseId,
    start_date: today,
    end_date: today,
  })
}

// ── 库存接口 ──────────────────────────────────────────────────
export async function fetchInventory(
  token: string,
  warehouseId?: string,
  skuList?: string[]
): Promise<InventoryItem[]> {
  return fetchAllPages<InventoryItem>(token, '/erp/wms/inventory/lists', {
    warehouse_id: warehouseId,
    sku_list: skuList,
  })
}

// ── 退件接口 ──────────────────────────────────────────────────
export async function fetchReturnOrders(
  token: string,
  warehouseId?: string,
  status?: number
): Promise<ReturnOrder[]> {
  return fetchAllPages<ReturnOrder>(token, '/erp/wms/return/lists', {
    warehouse_id: warehouseId,
    status: status ?? 1,  // 默认拉取待处理退件
  })
}

// ── 工单接口 ──────────────────────────────────────────────────
export async function fetchWorkOrders(
  token: string,
  status?: number
): Promise<WorkOrder[]> {
  return fetchAllPages<WorkOrder>(token, '/erp/wms/workorder/lists', {
    status: status ?? 1,  // 默认待审核
  })
}

// ── 绑定验证（测试AppKey是否有效） ───────────────────────────
export async function verifyAndBindCredentials(
  tenantId: string,
  appKey: string,
  appSecret: string
): Promise<{ success: boolean; message: string; warehouseCount?: number }> {
  try {
    // 1. 用AppKey/AppSecret 获取 Token
    const res = await fetch(LINGXING_AUTH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        appId: appKey,
        appSecret: appSecret,
        grantType: 'client_credentials',
      }),
    })

    const json: LingxingTokenResponse = await res.json()

    if (json.code !== 0 || !json.data?.access_token) {
      return { success: false, message: `授权失败: ${json.msg}（请检查 AppKey 和 AppSecret）` }
    }

    const { access_token, refresh_token, expires_in } = json.data

    // 2. 测试获取仓库列表
    const warehouseRes = await callLingxingAPI<{ id: string; name: string }[]>(
      access_token,
      '/erp/wms/warehouse/lists'
    )
    const warehouses = Array.isArray(warehouseRes.data) ? warehouseRes.data : []

    // 3. 加密存储到数据库
    await supabase
      .from('lingxing_credentials')
      .upsert({
        tenant_id:       tenantId,
        app_key:         encrypt(appKey),
        app_secret:      encrypt(appSecret),
        access_token:    encrypt(access_token),
        refresh_token:   encrypt(refresh_token),
        token_expire_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        warehouse_ids:   warehouses.map(w => w.id),
        auth_status:     1,
        sync_enabled:    true,
      }, { onConflict: 'tenant_id' })

    return {
      success: true,
      message: `绑定成功！检测到 ${warehouses.length} 个仓库`,
      warehouseCount: warehouses.length,
    }
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '未知错误'
    return { success: false, message: `绑定失败: ${message}` }
  }
}

// ── 日期工具函数 ──────────────────────────────────────────────
function getTodayStr(): string {
  return new Date().toISOString().split('T')[0]
}

function getDateDaysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString().split('T')[0]
}
