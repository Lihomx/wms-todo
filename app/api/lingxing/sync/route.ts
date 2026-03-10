// app/api/lingxing/sync/route.ts
// 手动触发同步 API 端点

import { NextResponse } from 'next/server'
import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase'
import {
  getValidToken,
  fetchPendingInbound,
  fetchReceivedPendingShelve,
  fetchPendingDropshipping,
  fetchTodayOutbound,
  fetchInventory,
  fetchReturnOrders,
  fetchWorkOrders,
} from '@/lib/lingxing'
import { generateTodosFromLingxing } from '@/lib/todo-generator'

export async function POST() {
  try {
    const supabase = getSupabaseServerClient()
    const adminSupabase = getSupabaseAdminClient()

    // 验证登录
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const { data: userInfo } = await supabase
      .from('users').select('tenant_id').eq('id', user.id).single()

    const tenantId = userInfo?.tenant_id
    if (!tenantId) return NextResponse.json({ error: '未找到账户信息' }, { status: 400 })

    // 检查绑定状态
    const { data: cred } = await adminSupabase
      .from('lingxing_credentials')
      .select('*')
      .eq('tenant_id', tenantId)
      .single()

    if (!cred || cred.auth_status !== 1) {
      return NextResponse.json({ error: '请先绑定领星账号' }, { status: 400 })
    }

    const startTime = Date.now()

    // 获取有效 Token
    const token = await getValidToken(tenantId)

    // 并发拉取所有数据
    const [
      pendingInbound,
      receivedInbound,
      pendingOutbound,
      todayOutbound,
      inventory,
      returns,
      workOrders,
    ] = await Promise.allSettled([
      fetchPendingInbound(token),
      fetchReceivedPendingShelve(token),
      fetchPendingDropshipping(token),
      fetchTodayOutbound(token),
      fetchInventory(token),
      fetchReturnOrders(token),
      fetchWorkOrders(token),
    ])

    const getData = <T>(r: PromiseSettledResult<T[]>): T[] =>
      r.status === 'fulfilled' ? r.value : []

    // 生成待办
    const result = await generateTodosFromLingxing(tenantId, {
      pendingInbound:  getData(pendingInbound),
      receivedInbound: getData(receivedInbound),
      pendingOutbound: getData(pendingOutbound),
      todayOutbound:   getData(todayOutbound),
      inventory:       getData(inventory),
      returns:         getData(returns),
      workOrders:      getData(workOrders),
    })

    // 更新最后同步时间
    await adminSupabase
      .from('lingxing_credentials')
      .update({ last_sync_at: new Date().toISOString() })
      .eq('tenant_id', tenantId)

    return NextResponse.json({
      success:      true,
      duration:     `${Date.now() - startTime}ms`,
      todosCreated: result.created,
      todosUpdated: result.updated,
      skipped:      result.skipped,
      message:      `同步完成：新建 ${result.created} 个待办，更新 ${result.updated} 个`,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '同步失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
