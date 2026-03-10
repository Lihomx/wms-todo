// sync-worker/index.js
// 定时同步任务 - 部署到 Railway
// 每15分钟从领星拉取数据，自动生成/更新待办

require('dotenv').config()
const cron = require('node-cron')
const { createClient } = require('@supabase/supabase-js')

// ── Supabase 客户端（使用 service_role 绕过 RLS）────────────
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// ── 加解密 ───────────────────────────────────────────────────
const CryptoJS = require('crypto-js')
const ENCRYPTION_SECRET = process.env.ENCRYPTION_SECRET

const decrypt = (ciphertext) => {
  const bytes = CryptoJS.AES.decrypt(ciphertext, ENCRYPTION_SECRET)
  return bytes.toString(CryptoJS.enc.Utf8)
}

const encrypt = (text) => CryptoJS.AES.encrypt(text, ENCRYPTION_SECRET).toString()

// ── 领星 API 基础配置 ────────────────────────────────────────
const LINGXING_AUTH_URL = process.env.LINGXING_AUTH_URL || 'https://openapi.lingxing.com/erp/sc/auth/token'
const LINGXING_API_BASE = process.env.LINGXING_API_BASE_URL || 'https://openapi.lingxing.com'
const SYNC_INTERVAL     = parseInt(process.env.SYNC_INTERVAL_MINUTES || '15')

// ── Token 刷新 ───────────────────────────────────────────────
async function getValidToken(cred) {
  const expireAt = new Date(cred.token_expire_at).getTime()

  // Token 还有 5 分钟有效期，直接返回
  if (expireAt > Date.now() + 5 * 60 * 1000) {
    return decrypt(cred.access_token)
  }

  // 刷新 Token
  console.log(`  [token] 租户 ${cred.tenant_id} Token 即将过期，刷新中...`)

  const appKey    = decrypt(cred.app_key)
  const appSecret = decrypt(cred.app_secret)

  const res = await fetch(LINGXING_AUTH_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      appId:        appKey,
      appSecret:    appSecret,
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
  }).eq('tenant_id', cred.tenant_id)

  return access_token
}

// ── 领星 API 请求 ────────────────────────────────────────────
async function callAPI(token, endpoint, body = {}) {
  const res = await fetch(`${LINGXING_API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  })
  const json = await res.json()
  if (json.code !== 0) throw new Error(`[${endpoint}] ${json.msg}`)
  return json.data
}

// 分页拉取
async function fetchAll(token, endpoint, params = {}, pageSize = 100) {
  const all = []
  let offset = 0
  while (true) {
    const data = await callAPI(token, endpoint, { ...params, offset, length: pageSize })
    const items = Array.isArray(data) ? data : (data?.list ?? [])
    all.push(...items)
    if (items.length < pageSize) break
    offset += pageSize
    await sleep(200)  // 限流保护
  }
  return all
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// ── 待办生成（幂等，已存在则跳过） ──────────────────────────
async function upsertTodo(tenantId, todo) {
  const { data: existing } = await supabase
    .from('todos')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('lingxing_order_no', todo.lingxing_order_no)
    .maybeSingle()

  if (existing) {
    // 已完成的待办不重新激活
    if (existing.status === 2) return 'skipped'
    await supabase.from('todos')
      .update({ title: todo.title, updated_at: new Date().toISOString() })
      .eq('id', existing.id)
    return 'updated'
  }

  const { data: inserted } = await supabase
    .from('todos')
    .insert({ tenant_id: tenantId, ...todo })
    .select('id')
    .single()

  // 自动生成检查项
  if (inserted && todo._checklist) {
    await supabase.from('checklist_items').insert(
      todo._checklist.map((content, i) => ({
        todo_id: inserted.id,
        content,
        sort_order: i + 1,
      }))
    )
    delete todo._checklist
  }

  return 'created'
}

// ── 单租户同步逻辑 ───────────────────────────────────────────
async function syncTenant(cred) {
  const tenantId = cred.tenant_id
  const logId = await startSyncLog(tenantId, 'all')
  const stats = { records: 0, created: 0, updated: 0, skipped: 0 }

  try {
    const token = await getValidToken(cred)
    const today = new Date().toISOString().split('T')[0]

    // ── 并发拉取所有数据 ─────────────────────────────────────
    const [pendingInbound, receivedInbound, pendingOutbound, todayOutbound, returns, workOrders] =
      await Promise.allSettled([
        fetchAll(token, '/erp/wms/inbound/lists',  { status: 1 }),  // 待入库
        fetchAll(token, '/erp/wms/inbound/lists',  { status: 3 }),  // 已收货待上架
        fetchAll(token, '/erp/wms/outbound/lists', { order_type: 1, status: 1 }), // 一件代发待处理
        fetchAll(token, '/erp/wms/outbound/lists', { start_date: today, end_date: today }), // 今日出库
        fetchAll(token, '/erp/wms/return/lists',   { status: 1 }),  // 待处理退件
        fetchAll(token, '/erp/wms/workorder/lists',{ status: 1 }),  // 待审核工单
      ])

    const getData = (r) => r.status === 'fulfilled' ? r.value : []

    // ── 处理待入库 ───────────────────────────────────────────
    for (const order of getData(pendingInbound)) {
      stats.records++
      const action = await upsertTodo(tenantId, {
        title:             `入库预报：${order.order_no}（${order.sku_count || '?'} SKU / ${order.total_qty || '?'} 件）`,
        category:          '入库作业',
        priority:          1,
        status:            0,
        due_date:          order.expected_arrival_date || null,
        source:            'lingxing_auto',
        lingxing_order_no: `inbound_${order.order_no}`,
        lingxing_data:     order,
        _checklist: [
          `核对货件清单：${order.sku_count || '?'} SKU / ${order.total_qty || '?'} 件`,
          '外包装破损检查，拍照记录',
          '系统扫描入库，分配库位',
          '完成上架，通知 OMP 更新库存',
        ]
      })
      stats[action === 'skipped' ? 'skipped' : action === 'created' ? 'created' : 'updated']++
    }

    // ── 处理已收货待上架 ─────────────────────────────────────
    for (const order of getData(receivedInbound)) {
      stats.records++
      const unshelved = (order.received_qty || 0) - (order.shelved_qty || 0)
      const action = await upsertTodo(tenantId, {
        title:             `待上架：${order.order_no}（${unshelved} 件待上架）`,
        category:          '入库作业',
        priority:          1,
        status:            0,
        source:            'lingxing_auto',
        lingxing_order_no: `shelve_${order.order_no}`,
        lingxing_data:     order,
      })
      stats[action === 'skipped' ? 'skipped' : action === 'created' ? 'created' : 'updated']++
    }

    // ── 处理一件代发（按天汇总） ─────────────────────────────
    const outboundByDate = {}
    for (const o of getData(pendingOutbound)) {
      const d = (o.created_at || today).split('T')[0]
      if (!outboundByDate[d]) outboundByDate[d] = []
      outboundByDate[d].push(o)
    }
    for (const [date, orders] of Object.entries(outboundByDate)) {
      stats.records++
      const action = await upsertTodo(tenantId, {
        title:             `一件代发：${date} 共 ${orders.length} 单待处理`,
        category:          '出库作业',
        priority:          1,
        status:            0,
        due_date:          date,
        source:            'lingxing_auto',
        lingxing_order_no: `dropshipping_${date}`,
      })
      stats[action === 'skipped' ? 'skipped' : action === 'created' ? 'created' : 'updated']++
    }

    // ── 今日出库汇总 ─────────────────────────────────────────
    const todayOrders = getData(todayOutbound)
    if (todayOrders.length > 0) {
      const byType = {}
      todayOrders.forEach(o => {
        byType[o.order_type_name || '其他'] = (byType[o.order_type_name || '其他'] || 0) + 1
      })
      const summary = Object.entries(byType).map(([k, v]) => `${k} ${v}单`).join(' / ')
      stats.records++
      const action = await upsertTodo(tenantId, {
        title:             `出库汇总 ${today}：${summary}`,
        category:          '出库作业',
        priority:          2,
        status:            0,
        due_date:          today,
        source:            'lingxing_auto',
        lingxing_order_no: `outbound_summary_${today}`,
      })
      stats[action === 'skipped' ? 'skipped' : action === 'created' ? 'created' : 'updated']++
    }

    // ── 处理退件 ─────────────────────────────────────────────
    for (const ret of getData(returns)) {
      stats.records++
      const action = await upsertTodo(tenantId, {
        title:             `退货处理：${ret.return_no}（${ret.platform || '?'} / ${ret.qty || '?'} 件）`,
        category:          '退货处理',
        priority:          1,
        status:            0,
        source:            'lingxing_auto',
        lingxing_order_no: `return_${ret.return_no}`,
        lingxing_data:     ret,
        _checklist: [
          '收到退货包裹，确认数量',
          '质检：判断良品/次品/残次品',
          '良品重新上架入库',
          '更新退货处理结果至系统',
        ]
      })
      stats[action === 'skipped' ? 'skipped' : action === 'created' ? 'created' : 'updated']++
    }

    // ── 处理工单 ─────────────────────────────────────────────
    for (const wo of getData(workOrders)) {
      stats.records++
      const action = await upsertTodo(tenantId, {
        title:             `工单：${wo.title}（${wo.work_order_no}）`,
        category:          '工单',
        priority:          2,
        status:            0,
        source:            'lingxing_auto',
        lingxing_order_no: `workorder_${wo.work_order_no}`,
      })
      stats[action === 'skipped' ? 'skipped' : action === 'created' ? 'created' : 'updated']++
    }

    // ── 更新最后同步时间 ─────────────────────────────────────
    await supabase.from('lingxing_credentials')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    await finishSyncLog(logId, 'success', stats)

    console.log(`  ✓ 租户 ${tenantId} 同步完成：拉取 ${stats.records} 条，新建 ${stats.created}，更新 ${stats.updated}，跳过 ${stats.skipped}`)

  } catch (err) {
    await finishSyncLog(logId, 'failed', stats, err.message)
    console.error(`  ✗ 租户 ${tenantId} 同步失败:`, err.message)
  }
}

// ── 同步日志 ────────────────────────────────────────────────
async function startSyncLog(tenantId, syncType) {
  const { data } = await supabase.from('sync_logs').insert({
    tenant_id: tenantId,
    sync_type: syncType,
    status:    'running',
  }).select('id').single()
  return data?.id
}

async function finishSyncLog(logId, status, stats, errorMsg = null) {
  if (!logId) return
  await supabase.from('sync_logs').update({
    status,
    records_fetched: stats.records,
    todos_created:   stats.created,
    todos_updated:   stats.updated,
    error_msg:       errorMsg,
    finished_at:     new Date().toISOString(),
  }).eq('id', logId)
}

// ── 主同步函数 ───────────────────────────────────────────────
async function runSync() {
  console.log(`\n[${new Date().toISOString()}] 开始全量同步...`)

  const { data: credentials, error } = await supabase
    .from('lingxing_credentials')
    .select('*')
    .eq('auth_status', 1)      // 只同步已绑定的
    .eq('sync_enabled', true)  // 且开启了自动同步

  if (error) {
    console.error('获取凭证失败:', error.message)
    return
  }

  if (!credentials || credentials.length === 0) {
    console.log('暂无已绑定的租户，跳过同步')
    return
  }

  console.log(`找到 ${credentials.length} 个已绑定租户，开始同步...`)

  // 并发同步所有租户（互不阻塞）
  await Promise.allSettled(credentials.map(cred => syncTenant(cred)))

  console.log(`[${new Date().toISOString()}] 全量同步完成\n`)
}

// ── 启动定时任务 ─────────────────────────────────────────────
console.log(`海外仓WMS同步Worker启动，同步间隔：${SYNC_INTERVAL}分钟`)

// 立即执行一次
runSync()

// 定时执行（每N分钟）
cron.schedule(`*/${SYNC_INTERVAL} * * * *`, runSync)

// Railway 健康检查端点（防止 Railway 认为服务崩溃）
const http = require('http')
http.createServer((req, res) => {
  res.writeHead(200)
  res.end(JSON.stringify({
    status: 'ok',
    service: 'wms-sync-worker',
    interval: `${SYNC_INTERVAL}min`,
    time: new Date().toISOString()
  }))
}).listen(process.env.PORT || 3001, () => {
  console.log(`健康检查端口: ${process.env.PORT || 3001}`)
})
