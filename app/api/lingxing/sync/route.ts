/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import {
  fetchInboundOrders,
  fetchOutboundOrders,
  fetchBigOutboundOrders,
  fetchInventory,
  fetchReturnOrders,
} from '@/lib/lingxing'
import { generateTodos } from '@/lib/todo-generator'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { tenantId } = await req.json()
    if (!tenantId) return NextResponse.json({ error: '缺少 tenantId' }, { status: 400 })

    // Parallel fetch from OMS
    const [inboundAll, outboundAll, bigOutboundAll, inventory, returns] = await Promise.allSettled([
      fetchInboundOrders(tenantId),       // all inbound
      fetchOutboundOrders(tenantId),      // 小包出库（一件代发）
      fetchBigOutboundOrders(tenantId),   // 大货出库（FBA备货）
      fetchInventory(tenantId),
      fetchReturnOrders(tenantId),
    ])

    const getVal = (r: PromiseSettledResult<any[]>) => r.status === 'fulfilled' ? r.value : []
    const getErr = (r: PromiseSettledResult<any[]>, name: string) =>
      r.status === 'rejected' ? `${name}: ${r.reason?.message ?? '失败'}` : null

    const errors = [
      getErr(inboundAll,     '入库单'),
      getErr(outboundAll,    '小包出库'),
      getErr(bigOutboundAll, '大货出库'),
      getErr(inventory,      '库存'),
      getErr(returns,        '退件单'),
    ].filter(Boolean)

    const inboundOrders    = getVal(inboundAll)
    const outboundOrders   = getVal(outboundAll)
    const bigOutboundOrders = getVal(bigOutboundAll)
    const inventoryItems   = getVal(inventory)
    const returnOrders     = getVal(returns)

    // Split inbound by status
    // OMS inbound status: 0=待收货, 1=已预约, 2=收货中, 3=已收货待上架, 4=已完成
    const pendingInbound  = inboundOrders.filter((o: any) => [0, 1, 2].includes(o.status))
    const receivedInbound = inboundOrders.filter((o: any) => o.status === 3)

    // Split outbound by status
    // OMS outbound status: 0=待处理, 1=处理中, 2=待出库, 3=已出库, 4=已取消
    const pendingOutbound = outboundOrders.filter((o: any) => [0, 1, 2].includes(o.status))
    const today = new Date().toISOString().split('T')[0]
    const todayOutbound   = [...outboundOrders, ...bigOutboundOrders].filter((o: any) => {
      const d = (o.created_time || o.createTime || o.create_time || '').split('T')[0]
      return d === today
    })

    // Returns: only pending
    // OMS return status: 0=待处理, 1=处理中, 2=已完成, 3=已取消
    const pendingReturns = returnOrders.filter((o: any) => [0, 1].includes(o.status))

    const generateResult = await generateTodos(tenantId, {
      pendingInbound,
      receivedInbound,
      pendingOutbound,
      todayOutbound,
      inventory: inventoryItems,
      returns:   pendingReturns,
    })

    // Update last_sync_at
    const supabase = getSupabaseAdminClient()
    await supabase
      .from('lingxing_credentials')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    return NextResponse.json({
      success:   true,
      ...generateResult,
      warnings:  errors,
      stats: {
        inbound:    inboundOrders.length,
        outbound:   outboundOrders.length,
        bigOutbound: bigOutboundOrders.length,
        inventory:  inventoryItems.length,
        returns:    returnOrders.length,
      }
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
