/* eslint-disable @typescript-eslint/no-explicit-any */
import { getSupabaseAdminClient } from './supabase-server'

export interface GenerateResult { created: number; updated: number; skipped: number }

const today = () => new Date().toISOString().split('T')[0]

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
    if (existing.status === 2) return 'skipped'
    await supabase.from('todos').update({ title: todo.title }).eq('id', existing.id)
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
    pendingInbound?: any[]
    receivedInbound?: any[]
    pendingOutbound?: any[]
    todayOutbound?: any[]
    inventory?: any[]
    returns?: any[]
    workOrders?: any[]
  }
): Promise<GenerateResult> {
  const result: GenerateResult = { created: 0, updated: 0, skipped: 0 }
  const supabase = getSupabaseAdminClient()

  const bump = (r: string) => { if (r === 'created') result.created++; else if (r === 'updated') result.updated++; else result.skipped++ }

  // 1. Pending inbound
  for (const o of data.pendingInbound ?? []) {
    const r = await upsertTodo(tenantId, {
      title: `入库预报：${o.order_no}（${o.sku_count ?? '?'} SKU / ${o.total_qty ?? '?'} 件）`,
      category: '入库作业', priority: 1, status: 0,
      due_date: o.expected_arrival_date || null,
      source: 'lingxing_auto', lingxing_order_no: `inbound_${o.order_no}`,
      _checklist: [`核对清单：${o.sku_count ?? '?'} SKU / ${o.total_qty ?? '?'} 件`, '外包装破损检查，拍照', '系统扫描入库，分配库位', '完成上架，通知 OMP 更新库存'],
    })
    bump(r)
  }

  // 2. Received, pending shelve
  for (const o of data.receivedInbound ?? []) {
    const unshelved = (o.received_qty || 0) - (o.shelved_qty || 0)
    const r = await upsertTodo(tenantId, {
      title: `待上架：${o.order_no}（${unshelved} 件待上架）`,
      category: '入库作业', priority: 1, status: 0,
      source: 'lingxing_auto', lingxing_order_no: `shelve_${o.order_no}`,
    })
    bump(r)
  }

  // 3. Dropshipping - group by date
  const byDate: Record<string, any[]> = {}
  for (const o of data.pendingOutbound ?? []) {
    const d = (o.created_at || today()).split('T')[0]
    if (!byDate[d]) byDate[d] = []
    byDate[d].push(o)
  }
  for (const [date, orders] of Object.entries(byDate)) {
    const r = await upsertTodo(tenantId, {
      title: `一件代发：${date} 共 ${orders.length} 单待处理`,
      category: '出库作业', priority: 1, status: 0, due_date: date,
      source: 'lingxing_auto', lingxing_order_no: `dropshipping_${date}`,
    })
    bump(r)
  }

  // 4. Today outbound summary
  const todayOrders = data.todayOutbound ?? []
  if (todayOrders.length > 0) {
    const byType: Record<string, number> = {}
    for (const o of todayOrders) {
      const t = (o.order_type_name as string) || '其他'
      byType[t] = (byType[t] || 0) + 1
    }
    const summary = Object.entries(byType).map(([k, v]) => `${k} ${v}单`).join(' / ')
    const r = await upsertTodo(tenantId, {
      title: `出库汇总 ${today()}：${summary}`,
      category: '出库作业', priority: 2, status: 0, due_date: today(),
      source: 'lingxing_auto', lingxing_order_no: `outbound_summary_${today()}`,
    })
    bump(r)
  }

  // 5. Inventory warnings
  const { data: warnings } = await supabase
    .from('inventory_warnings')
    .select('sku, warning_qty')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
  const warnMap: Record<string, number> = {}
  for (const w of warnings ?? []) warnMap[w.sku as string] = w.warning_qty as number

  for (const item of data.inventory ?? []) {
    const threshold = warnMap[item.sku as string] ?? 50
    if ((item.available_qty as number) >= threshold) continue
    const r = await upsertTodo(tenantId, {
      title: `库存预警：${item.sku}（${item.sku_name}）仅剩 ${item.available_qty} 件，低于 ${threshold}`,
      category: '库存管理', priority: item.available_qty === 0 ? 1 : 2, status: 0,
      source: 'lingxing_auto', lingxing_order_no: `inventory_${item.sku}`,
    })
    bump(r)
  }

  // 6. Returns
  for (const ret of data.returns ?? []) {
    const r = await upsertTodo(tenantId, {
      title: `退货处理：${ret.return_no}（${ret.platform ?? '?'} / ${ret.qty ?? '?'} 件）`,
      category: '退货处理', priority: 1, status: 0,
      source: 'lingxing_auto', lingxing_order_no: `return_${ret.return_no}`,
      _checklist: ['收到退货，确认数量', '质检：判断良品/次品', '良品重新上架', '更新处理结果'],
    })
    bump(r)
  }

  // 7. Work orders
  for (const wo of data.workOrders ?? []) {
    const r = await upsertTodo(tenantId, {
      title: `工单：${wo.title}（${wo.work_order_no}）`,
      category: '工单', priority: 2, status: 0,
      source: 'lingxing_auto', lingxing_order_no: `workorder_${wo.work_order_no}`,
    })
    bump(r)
  }

  return result
}
