import { NextRequest, NextResponse } from 'next/server'
import { verifyAndBind } from '@/lib/lingxing'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function POST(req: NextRequest) {
  try {
    const { tenantId, appKey, appSecret } = await req.json()
    if (!tenantId || !appKey || !appSecret) {
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
