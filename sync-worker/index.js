require('dotenv').config()
const cron      = require('node-cron')
const { createClient } = require('@supabase/supabase-js')
const CryptoJS  = require('crypto-js')
const http      = require('http')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

const SECRET      = process.env.ENCRYPTION_SECRET
const AUTH_URL    = process.env.LINGXING_AUTH_URL || 'https://openapi.lingxing.com/erp/sc/auth/token'
const API_BASE    = process.env.LINGXING_API_BASE_URL || 'https://openapi.lingxing.com'
const INTERVAL    = parseInt(process.env.SYNC_INTERVAL_MINUTES || '15')

const encrypt = t => CryptoJS.AES.encrypt(t, SECRET).toString()
const decrypt = t => CryptoJS.AES.decrypt(t, SECRET).toString(CryptoJS.enc.Utf8)
const sleep   = ms => new Promise(r => setTimeout(r, ms))
const today   = () => new Date().toISOString().split('T')[0]

async function getToken(cred) {
  if (new Date(cred.token_expire_at).getTime() > Date.now() + 5 * 60 * 1000) return decrypt(cred.access_token)
  const res  = await fetch(AUTH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ appId: decrypt(cred.app_key), appSecret: decrypt(cred.app_secret), grantType: 'refresh_token', refreshToken: decrypt(cred.refresh_token) }) })
  const json = await res.json()
  if (json.code !== 0) throw new Error(`Token refresh: ${json.msg}`)
  const { access_token, refresh_token, expires_in } = json.data
  await supabase.from('lingxing_credentials').update({ access_token: encrypt(access_token), refresh_token: encrypt(refresh_token), token_expire_at: new Date(Date.now() + expires_in * 1000).toISOString() }).eq('tenant_id', cred.tenant_id)
  return access_token
}

async function fetchAll(token, endpoint, params = {}) {
  const all = []; let offset = 0
  while (true) {
    const res  = await fetch(`${API_BASE}${endpoint}`, { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` }, body: JSON.stringify({ ...params, offset, length: 100 }) })
    const json = await res.json()
    if (json.code !== 0) break
    const items = Array.isArray(json.data) ? json.data : (json.data?.list ?? [])
    all.push(...items)
    if (items.length < 100) break
    offset += 100; await sleep(200)
  }
  return all
}

async function upsert(tenantId, todo) {
  const checklist = todo._checklist; delete todo._checklist
  const { data: ex } = await supabase.from('todos').select('id,status').eq('tenant_id', tenantId).eq('lingxing_order_no', todo.lingxing_order_no).maybeSingle()
  if (ex) { if (ex.status === 2) return 'skip'; await supabase.from('todos').update({ title: todo.title }).eq('id', ex.id); return 'update' }
  const { data: ins } = await supabase.from('todos').insert({ tenant_id: tenantId, ...todo }).select('id').single()
  if (ins && checklist) await supabase.from('checklist_items').insert(checklist.map((c, i) => ({ todo_id: ins.id, content: c, sort_order: i + 1 })))
  return 'create'
}

async function syncTenant(cred) {
  const tid = cred.tenant_id
  const token = await getToken(cred)
  const t = today()
  const [pi, ri, po, to, ret, wo] = await Promise.allSettled([
    fetchAll(token, '/erp/wms/inbound/lists',  { status: 1 }),
    fetchAll(token, '/erp/wms/inbound/lists',  { status: 3 }),
    fetchAll(token, '/erp/wms/outbound/lists', { order_type: 1, status: 1 }),
    fetchAll(token, '/erp/wms/outbound/lists', { start_date: t, end_date: t }),
    fetchAll(token, '/erp/wms/return/lists',    { status: 1 }),
    fetchAll(token, '/erp/wms/workorder/lists', { status: 1 }),
  ])
  const get = r => r.status === 'fulfilled' ? r.value : []
  let created = 0, updated = 0
  const bump = r => { if (r === 'create') created++; else if (r === 'update') updated++ }

  for (const o of get(pi)) bump(await upsert(tid, { title: `入库预报：${o.order_no}（${o.total_qty ?? '?'} 件）`, category: '入库作业', priority: 1, status: 0, due_date: o.expected_arrival_date || null, source: 'lingxing_auto', lingxing_order_no: `inbound_${o.order_no}`, _checklist: ['核对清单', '外包装检查', '系统扫描入库', '完成上架'] }))
  for (const o of get(ri)) bump(await upsert(tid, { title: `待上架：${o.order_no}（${(o.received_qty||0)-(o.shelved_qty||0)} 件）`, category: '入库作业', priority: 1, status: 0, source: 'lingxing_auto', lingxing_order_no: `shelve_${o.order_no}` }))

  const byDate = {}
  for (const o of get(po)) { const d = (o.created_at || t).split('T')[0]; if (!byDate[d]) byDate[d] = []; byDate[d].push(o) }
  for (const [d, orders] of Object.entries(byDate)) bump(await upsert(tid, { title: `一件代发：${d} 共 ${orders.length} 单`, category: '出库作业', priority: 1, status: 0, due_date: d, source: 'lingxing_auto', lingxing_order_no: `dropship_${d}` }))

  const todayOrders = get(to)
  if (todayOrders.length > 0) bump(await upsert(tid, { title: `出库汇总 ${t}：${todayOrders.length} 单`, category: '出库作业', priority: 2, status: 0, due_date: t, source: 'lingxing_auto', lingxing_order_no: `summary_${t}` }))
  for (const r of get(ret)) bump(await upsert(tid, { title: `退货：${r.return_no}（${r.qty ?? '?'} 件）`, category: '退货处理', priority: 1, status: 0, source: 'lingxing_auto', lingxing_order_no: `return_${r.return_no}`, _checklist: ['收货确认', '质检', '良品上架', '更新系统'] }))
  for (const w of get(wo)) bump(await upsert(tid, { title: `工单：${w.title}`, category: '工单', priority: 2, status: 0, source: 'lingxing_auto', lingxing_order_no: `wo_${w.work_order_no}` }))

  await supabase.from('lingxing_credentials').update({ last_sync_at: new Date().toISOString() }).eq('tenant_id', tid)
  console.log(`  ✓ ${tid}: +${created} ^${updated}`)
}

async function runSync() {
  console.log(`[${new Date().toISOString()}] Sync start`)
  const { data: creds } = await supabase.from('lingxing_credentials').select('*').eq('auth_status', 1).eq('sync_enabled', true)
  if (!creds?.length) { console.log('No active tenants'); return }
  await Promise.allSettled(creds.map(c => syncTenant(c).catch(e => console.error(`  ✗ ${c.tenant_id}:`, e.message))))
  console.log(`[${new Date().toISOString()}] Sync done`)
}

runSync()
cron.schedule(`*/${INTERVAL} * * * *`, runSync)

http.createServer((_, res) => { res.writeHead(200); res.end('ok') }).listen(process.env.PORT || 3001)
console.log(`Worker started, interval: ${INTERVAL}min`)
