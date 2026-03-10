/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { getValidToken, fetchPendingInbound, fetchReceivedInbound, fetchPendingOutbound, fetchTodayOutbound, fetchInventory, fetchReturns, fetchWorkOrders } from '@/lib/lingxing'
import { generateTodos } from '@/lib/todo-generator'

const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

export async function POST() {
  const start = Date.now()
  try {
    const token = await getValidToken(DEFAULT_TENANT)

    const results = await Promise.allSettled([
      fetchPendingInbound(token),
      fetchReceivedInbound(token),
      fetchPendingOutbound(token),
      fetchTodayOutbound(token),
      fetchInventory(token),
      fetchReturns(token),
      fetchWorkOrders(token),
    ])

    const get = (r: any) => r.status === 'fulfilled' ? r.value : []
    const [pi, ri, po, to, inv, ret, wo] = results

    const result = await generateTodos(DEFAULT_TENANT, {
      pendingInbound:  get(pi),
      receivedInbound: get(ri),
      pendingOutbound: get(po),
      todayOutbound:   get(to),
      inventory:       get(inv),
      returns:         get(ret),
      workOrders:      get(wo),
    })

    await getSupabaseAdminClient().from('lingxing_credentials').update({ last_sync_at: new Date().toISOString() }).eq('tenant_id', DEFAULT_TENANT)

    return NextResponse.json({
      success:      true,
      duration:     `${Date.now() - start}ms`,
      todosCreated: result.created,
      todosUpdated: result.updated,
      message:      `同步完成：新建 ${result.created} 个，更新 ${result.updated} 个`,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '同步失败' }, { status: 500 })
  }
}
