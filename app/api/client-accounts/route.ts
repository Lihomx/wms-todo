/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { createClient } from '@supabase/supabase-js'

export async function GET(req: NextRequest) {
  const customerCode = new URL(req.url).searchParams.get('customerCode')
  const supabase = getSupabaseAdminClient()
  let q = supabase.from('client_accounts').select('*, oms_clients(customer_name)').order('created_at', { ascending: false })
  if (customerCode) q = q.eq('customer_code', customerCode)
  const { data, error } = await q
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ accounts: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const { display_name, email, password, customer_code, role } = await req.json()
    if (!display_name || !email || !password || !customer_code) {
      return NextResponse.json({ error: '姓名、邮箱、密码、客户代码均必填' }, { status: 400 })
    }
    const adminClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    )
    const { data: authUser, error: authErr } = await adminClient.auth.admin.createUser({
      email, password, email_confirm: true,
    })
    if (authErr) return NextResponse.json({ error: `创建账号失败: ${authErr.message}` }, { status: 400 })

    const supabase = getSupabaseAdminClient()
    const { error: dbErr } = await supabase.from('client_accounts').insert({
      id: authUser.user!.id, customer_code, display_name, email,
      role: role || 'client_operator',
    })
    if (dbErr) return NextResponse.json({ error: `保存账号信息失败: ${dbErr.message}` }, { status: 500 })
    return NextResponse.json({ success: true, userId: authUser.user!.id }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
  await adminClient.auth.admin.deleteUser(id)
  const supabase = getSupabaseAdminClient()
  await supabase.from('client_accounts').delete().eq('id', id)
  return NextResponse.json({ success: true })
}

export async function PATCH(req: NextRequest) {
  const { id, display_name, is_active } = await req.json()
  if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
  const supabase = getSupabaseAdminClient()
  const { error } = await supabase.from('client_accounts')
    .update({ ...(display_name !== undefined && { display_name }), ...(is_active !== undefined && { is_active }) })
    .eq('id', id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
