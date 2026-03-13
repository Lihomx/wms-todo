/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { verifyAndBind } from '@/lib/lingxing'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

// ── GET: 读取当前绑定状态 ─────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tenantId = searchParams.get('tenantId') ?? DEFAULT_TENANT

    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase
      .from('lingxing_credentials')
      .select('auth_status, last_sync_at, warehouse_ids, sync_enabled')
      .eq('tenant_id', tenantId)
      .maybeSingle()

    if (error) throw error

    if (!data) {
      return NextResponse.json({ bound: false, authStatus: 0 })
    }

    return NextResponse.json({
      bound:          data.auth_status === 1,
      authStatus:     data.auth_status,
      lastSyncAt:     data.last_sync_at ?? null,
      warehouseCount: Array.isArray(data.warehouse_ids) ? data.warehouse_ids.length : 0,
      syncEnabled:    data.sync_enabled ?? false,
    })
  } catch (err: any) {
    return NextResponse.json({ bound: false, authStatus: 0, error: err.message })
  }
}

// ── POST: 验证并绑定 ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const body     = await req.json()
    const tenantId = body.tenantId ?? DEFAULT_TENANT
    const { appKey, appSecret } = body

    if (!appKey || !appSecret) {
      return NextResponse.json({ error: '缺少必要参数 appKey / appSecret' }, { status: 400 })
    }

    const result = await verifyAndBind(tenantId, appKey, appSecret)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? '未知错误' }, { status: 500 })
  }
}

// ── DELETE: 解绑 ─────────────────────────────────────────────
export async function DELETE(req: NextRequest) {
  try {
    const body     = await req.json()
    const tenantId = body.tenantId ?? DEFAULT_TENANT

    const supabase = getSupabaseAdminClient()
    const { error } = await supabase
      .from('lingxing_credentials')
      .update({ auth_status: 0, sync_enabled: false })
      .eq('tenant_id', tenantId)

    if (error) throw error
    return NextResponse.json({ success: true })
  } catch (err: any) {
    return NextResponse.json({ error: err.message ?? '解绑失败' }, { status: 500 })
  }
}
