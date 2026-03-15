import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

export async function POST(req: NextRequest) {
  const { confirm } = await req.json().catch(() => ({}))
  if (confirm !== 'yes') return NextResponse.json({ error: '请传入 confirm:"yes"' }, { status: 400 })
  const supabase = getSupabaseAdminClient()
  const { count: before } = await supabase.from('todos').select('*',{count:'exact',head:true}).eq('tenant_id',DEFAULT_TENANT).is('customer_code',null)
  const { error } = await supabase.from('todos').delete().eq('tenant_id',DEFAULT_TENANT).is('customer_code',null)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  const { count: after } = await supabase.from('todos').select('*',{count:'exact',head:true}).eq('tenant_id',DEFAULT_TENANT)
  return NextResponse.json({ success:true, message:`已删除 ${before} 条未分配客户数据，剩余 ${after} 条`, deleted:before, remaining:after })
}
