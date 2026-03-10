/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { verifyAndBind } from '@/lib/lingxing'

// For MVP: use a fixed tenant ID. In production, derive from auth session.
const DEFAULT_TENANT = process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  try {
    const { appKey, appSecret } = await req.json()
    if (!appKey || !appSecret) return NextResponse.json({ error: 'AppKey 和 AppSecret 不能为空' }, { status: 400 })
    const result = await verifyAndBind(DEFAULT_TENANT, appKey, appSecret)
    if (!result.success) return NextResponse.json({ error: result.message }, { status: 400 })
    return NextResponse.json({ success: true, message: result.message, warehouseCount: result.warehouseCount })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '服务器错误' }, { status: 500 })
  }
}

export async function DELETE() {
  try {
    const supabase = getSupabaseAdminClient()
    await supabase.from('lingxing_credentials').update({ auth_status: 0, sync_enabled: false, access_token: null, refresh_token: null }).eq('tenant_id', DEFAULT_TENANT)
    return NextResponse.json({ success: true, message: '已成功解绑' })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '服务器错误' }, { status: 500 })
  }
}

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()
    const { data } = await supabase.from('lingxing_credentials').select('auth_status,last_sync_at,warehouse_ids,token_expire_at').eq('tenant_id', DEFAULT_TENANT).maybeSingle()
    if (!data || data.auth_status === 0) return NextResponse.json({ bound: false })
    return NextResponse.json({
      bound: true,
      authStatus:     data.auth_status,
      lastSyncAt:     data.last_sync_at,
      warehouseCount: Array.isArray(data.warehouse_ids) ? data.warehouse_ids.length : 0,
      tokenExpireAt:  data.token_expire_at,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '服务器错误' }, { status: 500 })
  }
}
