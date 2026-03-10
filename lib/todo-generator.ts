// lib/todo-generator.ts
// 根据领星数据自动生成待办事项

import { getSupabaseAdminClient } from './supabase-server'
import type {
  InboundOrder, OutboundOrder,
  InventoryItem, ReturnOrder, WorkOrder
} from './lingxing'

const supabase = getSupabaseAdminClient()

interface GenerateResult {
  created: number
  updated: number
  skipped: number
}

// ── 主入口：处理所有类型的待办生成 ──────────────────────────
export async function generateTodosFromLingxing(
  tenantId: string,
  data: {
    pendingInbound?: InboundOrder[]       // 待入库
    receivedInbound?: InboundOrder[]      // 已收货待上架
    pendingOutbound?: OutboundOrder[]     // 待处理出库（一件代发）
    todayOutbound?: OutboundOrder[]       // 今日出库汇总
    inventory?: InventoryItem[]           // 库存数据
    returns?: ReturnOrder[]               // 退件
    workOrders?: WorkOrder[]              // 工单
  }
): Promise<GenerateResult> {
  const result: GenerateResult = { created: 0, updated: 0, skipped: 0 }

  const tasks = [
    data.pendingInbound     && generateInboundTodos(tenantId, data.pendingInbound, result),
    data.receivedInbound    && generateShelveTodos(tenantId, data.receivedInbound, result),
    data.pendingOutbound    && generateDropshippingTodos(tenantId, data.pendingOutbound, result),
    data.todayOutbound      && generateTodayOutboundSummary(tenantId, data.todayOutbound, result),
    data.inventory          && generateInventoryWarningTodos(tenantId, data.inventory, result),
    data.returns            && generateReturnTodos(tenantId, data.returns, result),
    data.workOrders         && generateWorkOrderTodos(tenantId, data.workOrders, result),
  ].filter(Boolean)

  await Promise.all(tasks)
  return result
}

// ── 1. 待入库单 → 生成入库待办 ───────────────────────────────
async function generateInboundTodos(
  tenantId: string,
  orders: InboundOrder[],
  result: GenerateResult
) {
  for (const order of orders) {
    const orderKey = `inbound_${order.order_no}`

    const existing = await getTodoByOrderNo(tenantId, orderKey)

    if (existing) {
      // 已存在，检查是否需要更新标题（件数变化等）
      result.skipped++
      continue
    }

    const daysUntilArrival = order.expected_arrival_date
      ? daysDiff(new Date(), new Date(order.expected_arrival_date))
      : 99

    await supabase.from('todos').insert({
      tenant_id:          tenantId,
      title:              `入库预报：${order.order_no}（${order.sku_count} SKU / 共 ${order.total_qty} 件）`,
      description:        `仓库：${order.warehouse_name}\n预计到货：${order.expected_arrival_date || '未知'}\n备注：${order.remark || '无'}`,
      category:           '入库作业',
      priority:           daysUntilArrival <= 2 ? 1 : 2,
      status:             0,
      due_date:           order.expected_arrival_date || null,
      source:             'lingxing_auto',
      lingxing_order_no:  orderKey,
      lingxing_data:      order as unknown as Record<string, unknown>,
    })

    // 自动生成检查项
    await createInboundChecklist(tenantId, orderKey, order)
    result.created++
  }
}

async function createInboundChecklist(tenantId: string, orderKey: string, order: InboundOrder) {
  const { data: todo } = await supabase
    .from('todos')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('lingxing_order_no', orderKey)
    .single()

  if (!todo) return

  const items = [
    { content: `核对货件清单，确认 ${order.sku_count} SKU / ${order.total_qty} 件数量`, sort_order: 1 },
    { content: '外包装破损检查，拍照记录存档', sort_order: 2 },
    { content: '系统扫描入库，分配库位', sort_order: 3 },
    { content: '完成上架，通知 OMP 更新库存数据', sort_order: 4 },
  ]

  await supabase.from('checklist_items').insert(
    items.map(item => ({ ...item, todo_id: todo.id }))
  )
}

// ── 2. 已收货待上架 → 生成上架待办 ──────────────────────────
async function generateShelveTodos(
  tenantId: string,
  orders: InboundOrder[],
  result: GenerateResult
) {
  for (const order of orders) {
    const orderKey = `shelve_${order.order_no}`

    if (await getTodoByOrderNo(tenantId, orderKey)) {
      result.skipped++
      continue
    }

    const unshelvedQty = order.received_qty - order.shelved_qty

    await supabase.from('todos').insert({
      tenant_id:         tenantId,
      title:             `待上架：${order.order_no}（待上架 ${unshelvedQty} 件）`,
      description:       `仓库：${order.warehouse_name}\n已收货：${order.received_qty} 件\n待上架：${unshelvedQty} 件`,
      category:          '入库作业',
      priority:          1,  // 已收货待上架视为紧急
      status:            0,
      source:            'lingxing_auto',
      lingxing_order_no: orderKey,
      lingxing_data:     order as unknown as Record<string, unknown>,
    })

    result.created++
  }
}

// ── 3. 一件代发待处理 → 生成出库待办 ────────────────────────
async function generateDropshippingTodos(
  tenantId: string,
  orders: OutboundOrder[],
  result: GenerateResult
) {
  // 一件代发批量归并为按天汇总，避免每单都生成一个待办
  const byDate: Record<string, OutboundOrder[]> = {}

  for (const order of orders) {
    const date = order.created_at.split('T')[0]
    if (!byDate[date]) byDate[date] = []
    byDate[date].push(order)
  }

  for (const [date, dateOrders] of Object.entries(byDate)) {
    const orderKey = `dropshipping_batch_${date}`

    if (await getTodoByOrderNo(tenantId, orderKey)) {
      result.skipped++
      continue
    }

    const totalQty = dateOrders.reduce(
      (sum, o) => sum + o.products.reduce((s, p) => s + p.qty, 0), 0
    )

    await supabase.from('todos').insert({
      tenant_id:         tenantId,
      title:             `一件代发出库：${date} 共 ${dateOrders.length} 单 / ${totalQty} 件待处理`,
      description:       `平台：${[...new Set(dateOrders.map(o => o.platform))].join('、')}\n仓库：${dateOrders[0]?.warehouse_name}`,
      category:          '出库作业',
      priority:          1,
      status:            0,
      due_date:          date,
      source:            'lingxing_auto',
      lingxing_order_no: orderKey,
    })

    result.created++
  }
}

// ── 4. 今日出库汇总 → 更新出库看板 ──────────────────────────
async function generateTodayOutboundSummary(
  tenantId: string,
  orders: OutboundOrder[],
  result: GenerateResult
) {
  const today = new Date().toISOString().split('T')[0]
  const orderKey = `outbound_summary_${today}`

  const existing = await getTodoByOrderNo(tenantId, orderKey)

  const byType: Record<string, number> = {}
  for (const order of orders) {
    byType[order.order_type_name] = (byType[order.order_type_name] || 0) + 1
  }

  const title = `出库汇总 ${today}：${Object.entries(byType).map(([k, v]) => `${k} ${v}单`).join(' / ')}`

  if (existing) {
    // 每天更新汇总待办
    await supabase.from('todos')
      .update({ title, updated_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)
      .eq('lingxing_order_no', orderKey)
    result.updated++
  } else {
    await supabase.from('todos').insert({
      tenant_id:         tenantId,
      title,
      category:          '出库作业',
      priority:          2,
      status:            0,
      due_date:          today,
      source:            'lingxing_auto',
      lingxing_order_no: orderKey,
    })
    result.created++
  }
}

// ── 5. 库存预警 → 生成库存待办 ──────────────────────────────
async function generateInventoryWarningTodos(
  tenantId: string,
  items: InventoryItem[],
  result: GenerateResult
) {
  // 获取该租户配置的预警阈值
  const { data: warnings } = await supabase
    .from('inventory_warnings')
    .select('*')
    .eq('tenant_id', tenantId)
    .eq('is_active', true)

  const warningMap = new Map(warnings?.map(w => [w.sku, w]) ?? [])
  const defaultQty = parseInt(process.env.DEFAULT_INVENTORY_WARNING_QTY || '50')

  for (const item of items) {
    const config = warningMap.get(item.sku)
    const threshold = config?.warning_qty ?? defaultQty

    if (item.available_qty >= threshold) continue  // 库存充足，跳过

    const orderKey = `inventory_warning_${item.sku}`
    const existing = await getTodoByOrderNo(tenantId, orderKey)

    const title = `库存预警：${item.sku}（${item.sku_name}）仅剩 ${item.available_qty} 件，低于预警值 ${threshold}`

    if (existing) {
      // 更新库存数量
      await supabase.from('todos')
        .update({ title, status: 0 })  // 重新激活
        .eq('tenant_id', tenantId)
        .eq('lingxing_order_no', orderKey)

      // 同步更新库存表
      if (config) {
        await supabase.from('inventory_warnings')
          .update({ current_qty: item.available_qty })
          .eq('id', config.id)
      }

      result.updated++
    } else {
      await supabase.from('todos').insert({
        tenant_id:         tenantId,
        title,
        description:       `仓库：${item.warehouse_name}\n可用：${item.available_qty} 件 / 锁定：${item.locked_qty} 件 / 退货：${item.return_qty} 件`,
        category:          '库存管理',
        priority:          item.available_qty === 0 ? 1 : 2,
        status:            0,
        source:            'lingxing_auto',
        lingxing_order_no: orderKey,
        lingxing_data:     item as unknown as Record<string, unknown>,
      })
      result.created++
    }
  }
}

// ── 6. 退件单 → 生成退货待办 ────────────────────────────────
async function generateReturnTodos(
  tenantId: string,
  returns: ReturnOrder[],
  result: GenerateResult
) {
  for (const ret of returns) {
    const orderKey = `return_${ret.return_no}`

    if (await getTodoByOrderNo(tenantId, orderKey)) {
      result.skipped++
      continue
    }

    await supabase.from('todos').insert({
      tenant_id:         tenantId,
      title:             `退货处理：${ret.return_no}（${ret.platform} / ${ret.qty} 件 / ${ret.condition}）`,
      description:       `原订单：${ret.original_order_no}\nSKU：${ret.sku || '待确认'}\nFNSKU：${ret.fnsku || '无'}\n备注：${ret.remark || '无'}`,
      category:          '退货处理',
      priority:          1,
      status:            0,
      source:            'lingxing_auto',
      lingxing_order_no: orderKey,
      lingxing_data:     ret as unknown as Record<string, unknown>,
    })

    // 退货检查项
    const { data: todo } = await supabase
      .from('todos').select('id')
      .eq('tenant_id', tenantId)
      .eq('lingxing_order_no', orderKey)
      .single()

    if (todo) {
      await supabase.from('checklist_items').insert([
        { todo_id: todo.id, content: '收到退货包裹，确认数量', sort_order: 1 },
        { todo_id: todo.id, content: '质检：判断良品/次品/残次品', sort_order: 2 },
        { todo_id: todo.id, content: '良品重新上架入库', sort_order: 3 },
        { todo_id: todo.id, content: '更新退货处理结果至系统', sort_order: 4 },
      ])
    }

    result.created++
  }
}

// ── 7. 工单 → 生成工单待办 ──────────────────────────────────
async function generateWorkOrderTodos(
  tenantId: string,
  workOrders: WorkOrder[],
  result: GenerateResult
) {
  for (const wo of workOrders) {
    const orderKey = `workorder_${wo.work_order_no}`

    if (await getTodoByOrderNo(tenantId, orderKey)) {
      result.skipped++
      continue
    }

    await supabase.from('todos').insert({
      tenant_id:         tenantId,
      title:             `工单处理：${wo.title}（${wo.work_order_no}）`,
      description:       wo.description,
      category:          '工单',
      priority:          2,
      status:            0,
      source:            'lingxing_auto',
      lingxing_order_no: orderKey,
    })

    result.created++
  }
}

// ── 工具函数 ─────────────────────────────────────────────────
async function getTodoByOrderNo(tenantId: string, orderNo: string) {
  const { data } = await supabase
    .from('todos')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('lingxing_order_no', orderNo)
    .maybeSingle()
  return data
}

function daysDiff(a: Date, b: Date): number {
  return Math.ceil((b.getTime() - a.getTime()) / (1000 * 60 * 60 * 24))
}
