/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.from('oms_clients').select('*').order('customer_code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { customer_code, customer_name, oms_account, company_name } = body
    if (!customer_code || !customer_name) return NextResponse.json({ error: '客户代码和名称必填' }, { status: 400 })
    const supabase = getSupabaseAdminClient()
    const { data, error } = await supabase.from('oms_clients').insert({
      customer_code: customer_code.trim(), customer_name: customer_name.trim(),
      oms_account: oms_account?.trim() ?? '', company_name: company_name?.trim() ?? '',
      status: 'active', auth_status: 0,
    }).select().single()
    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ client: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
