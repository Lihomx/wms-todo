/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * todo-generator.ts
 * 将领星OMS原始数据转换为系统待办
 *
 * OMS 字段说明（实际字段以API返回为准）：
 * 入库单: order_no / inboundOrderNo, status, expected_arrival_date, sku_count, total_qty
 * 出库单: order_no / outboundOrderNo, status, created_time, platform_order_no
 * 库存:   sku, sku_name / skuName, available_qty / availableQty
 * 退件单: return_no / returnOrderNo, status, platform, qty
 */
import { getSupabaseAdminClient } from './supabase-server'

export interface GenerateResult { created: number; updated: number; skipped: number }

const today = () => new Date().toISOString().split('T')[0]

// Normalize field names from OMS (camelCase or snake_case)
function norm(o: any, ...keys: string[]): any {
  for (const k of keys) if (o[k] !== undefined && o[k] !== null) return o[k]
  return undefined
}

async function upsertTodo(tenantId: string, todo: Record<string, any>): Promise<'created' | 'updated' | 'skipped'> {
  const supabase  = getSupabaseAdminClient()
  const checklist = todo._checklist as string[] | undefined
  delete todo._checklist

  const { data: existing } = await supabase
    .from('todos')
    .select('id, status')
    .eq('tenant_id', tenantId)
    .eq('lingxing_order_no', todo.lingxing_order_no)
    .maybeSingle()

  if (existing) {
    if (existing.status === 2) return 'skipped' // 已完成
    await supabase.from('todos').update({ title: todo.title, priority: todo.priority }).eq('id', existing.id)
    return 'updated'
  }

  const { data: inserted } = await supabase
    .from('todos')
    .insert({ tenant_id: tenantId, ...todo })
    .select('id')
    .single()

  if (inserted && checklist && checklist.length > 0) {
    await supabase.from('checklist_items').insert(
      checklist.map((content: string, i: number) => ({ todo_id: inserted.id, content, sort_order: i + 1 }))
    )
  }
  return 'created'
}

export async function generateTodos(
  tenantId: string,
  data: {
    pendingInbound?:  any[]
    receivedInbound?: any[]
    pendingOutbound?: any[]
    todayOutbound?:   any[]
    inventory?:       any[]
    returns?:         any[]
  }
): Promise<GenerateResult> {
  const result: GenerateResult = { created: 0, updated: 0, skipped: 0 }
  const supabase = getSupabaseAdminClient()
  const bump = (r: string) => {
    if (r === 'created') result.created++
    else if (r === 'updated') result.updated++
    else result.skipped++
  }

  // ── 1. 待入库（预报/收货中）─────────────────────────────────
  for (const o of data.pendingInbound ?? []) {
    const no       = norm(o, 'order_no', 'inboundOrderNo', 'orderNo')
    const skuCnt   = norm(o, 'sku_count', 'skuCount', 'skuNum') ?? '?'
    const totalQty = norm(o, 'total_qty', 'totalQty', 'totalNum') ?? '?'
    const dueDate  = norm(o, 'expected_arrival_date', 'expectedArrivalDate', 'expectedDate') ?? null

    const r = await upsertTodo(tenantId, {
      title:    `入库预报：${no}（${skuCnt} SKU / ${totalQty} 件）`,
      category: '入库作业',
      priority: 1,
      status:   0,
      due_date: dueDate ? String(dueDate).split('T')[0] : null,
      source:   'lingxing_auto',
      lingxing_order_no: `inbound_${no}`,
      _checklist: [
        `核对货物清单：${skuCnt} SKU / ${totalQty} 件`,
        '检查外包装，拍照记录破损',
        '扫描入库，分配库位',
        '完成上架，更新库存',
      ],
    })
    bump(r)
  }

  // ── 2. 已收货待上架 ──────────────────────────────────────────
  for (const o of data.receivedInbound ?? []) {
    const no         = norm(o, 'order_no', 'inboundOrderNo', 'orderNo')
    const received   = norm(o, 'received_qty', 'receivedQty') ?? 0
    const shelved    = norm(o, 'shelved_qty',  'shelvedQty')  ?? 0
    const unshelved  = received - shelved

    const r = await upsertTodo(tenantId, {
      title:    `待上架：${no}（${unshelved} 件待上架）`,
      category: '入库作业',
      priority: 1,
      status:   0,
      source:   'lingxing_auto',
      lingxing_order_no: `shelve_${no}`,
      _checklist: [
        `扫描商品（共 ${unshelved} 件）`,
        '按仓位规则上架',
        '更新系统库位',
      ],
    })
    bump(r)
  }

  // ── 3. 一件代发出库（按日期分组）───────────────────────────
  const byDate: Record<string, any[]> = {}
  for (const o of data.pendingOutbound ?? []) {
    const d = String(norm(o, 'created_time', 'createTime', 'createdAt') || today()).split('T')[0]
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(o)
  }
  for (const [date, orders] of Object.entries(byDate)) {
    const r = await upsertTodo(tenantId, {
      title:    `一件代发：${date} 共 ${orders.length} 单待处理`,
      category: '出库作业',
      priority: 1,
      status:   0,
      due_date: date,
      source:   'lingxing_auto',
      lingxing_order_no: `dropshipping_${date}`,
      _checklist: [
        `核对 ${orders.length} 张出库单`,
        '拣货、打包',
        '打印面单，交接物流',
        '系统确认发货',
      ],
    })
    bump(r)
  }

  // ── 4. 今日出库汇总 ─────────────────────────────────────────
  const todayOrders = data.todayOutbound ?? []
  if (todayOrders.length > 0) {
    const r = await upsertTodo(tenantId, {
      title:    `出库汇总 ${today()}：共 ${todayOrders.length} 单`,
      category: '出库作业',
      priority: 2,
      status:   0,
      due_date: today(),
      source:   'lingxing_auto',
      lingxing_order_no: `outbound_summary_${today()}`,
    })
    bump(r)
  }

  // ── 5. 库存预警 ─────────────────────────────────────────────
  const { data: warnings } = await supabase
    .from('inventory_warnings')
    .select('sku, warning_qty')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
  const warnMap: Record<string, number> = {}
  for (const w of warnings ?? []) warnMap[w.sku as string] = w.warning_qty as number

  for (const item of data.inventory ?? []) {
    const sku     = norm(item, 'sku', 'skuCode')
    const skuName = norm(item, 'sku_name', 'skuName', 'productName') ?? ''
    const avail   = norm(item, 'available_qty', 'availableQty', 'availableQuantity') ?? 0
    const threshold = warnMap[sku] ?? 50

    if (Number(avail) >= threshold) continue

    const r = await upsertTodo(tenantId, {
      title:    `库存预警：${sku}（${skuName}）仅剩 ${avail} 件，低于 ${threshold}`,
      category: '库存管理',
      priority: Number(avail) === 0 ? 1 : 2,
      status:   0,
      source:   'lingxing_auto',
      lingxing_order_no: `inventory_${sku}`,
    })
    bump(r)
  }

  // ── 6. 退件处理 ─────────────────────────────────────────────
  for (const ret of data.returns ?? []) {
    const no       = norm(ret, 'return_no', 'returnOrderNo', 'returnNo')
    const platform = norm(ret, 'platform', 'platformName') ?? '?'
    const qty      = norm(ret, 'qty', 'quantity', 'totalQty') ?? '?'

    const r = await upsertTodo(tenantId, {
      title:    `退货处理：${no}（${platform} / ${qty} 件）`,
      category: '退货处理',
      priority: 1,
      status:   0,
      source:   'lingxing_auto',
      lingxing_order_no: `return_${no}`,
      _checklist: [
        '收到退货，确认数量与单据',
        '质检：拍照，判断良品/次品/报废',
        '良品重新上架入库',
        '系统更新处理结果',
      ],
    })
    bump(r)
  }

  return result
}
