import { NextRequest, NextResponse } from 'next/server'
import { verifyAndBind } from '@/lib/lingxing'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const tenantId = body.tenantId || process.env.DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'
    const { appKey, appSecret } = body
    if (!appKey || !appSecret) {
      return NextResponse.json({ error: '缺少必要参数' }, { status: 400 })
    }
    const result = await verifyAndBind(tenantId, appKey, appSecret)
    return NextResponse.json(result, { status: result.success ? 200 : 400 })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { tenantId } = await req.json()
    if (!tenantId) return NextResponse.json({ error: '缺少 tenantId' }, { status: 400 })
    const supabase = getSupabaseAdminClient()
    await supabase.from('lingxing_credentials').delete().eq('tenant_id', tenantId)
    return NextResponse.json({ success: true })
  } catch (err) {
    const msg = err instanceof Error ? err.message : '未知错误'
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
