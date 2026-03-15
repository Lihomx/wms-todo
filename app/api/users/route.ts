/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('user_profiles')
    .select('id,display_name,email,role,language,is_active,created_at')
    .eq('tenant_id', DEFAULT_TENANT)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ users: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const { display_name, email, password, role, language } = await req.json()
    if (!display_name || !email || !password) return NextResponse.json({ error: '姓名、邮箱、密码不能为空' }, { status: 400 })

    // Create auth user with service role
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )

    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authErr) return NextResponse.json({ error: `创建账号失败: ${authErr.message}` }, { status: 400 })

    // Create profile
    const supabase = getSupabaseAdminClient()
    const { error: profileErr } = await supabase.from('user_profiles').insert({
      id:           authUser.user!.id,
      tenant_id:    DEFAULT_TENANT,
      display_name, email,
      role:         role ?? 'warehouse_staff',
      language:     language ?? 'zh',
    })
    if (profileErr) return NextResponse.json({ error: `保存档案失败: ${profileErr.message}` }, { status: 500 })

    return NextResponse.json({ success: true, userId: authUser.user!.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
