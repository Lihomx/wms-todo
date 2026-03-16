/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { decrypt } from '@/lib/crypto'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.from('oms_clients').select('*').order('customer_code')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const { customer_code, customer_name, oms_account, company_name } = await req.json()
    if (!customer_code || !customer_name) return NextResponse.json({ error: '客户代码和名称必填' }, { status: 400 })
    const supabase = getSupabaseAdminClient()

    // Check duplicate customer_code
    const { data: existing } = await supabase.from('oms_clients')
      .select('id').eq('customer_code', customer_code.trim()).maybeSingle()
    if (existing) return NextResponse.json({ error: `客户代码 ${customer_code} 已存在` }, { status: 409 })

    const { data, error } = await supabase.from('oms_clients').insert({
      customer_code: customer_code.trim(),
      customer_name: customer_name.trim(),
      oms_account:   oms_account?.trim() ?? '',
      company_name:  company_name?.trim() ?? '',
      status: 'active', auth_status: 0,
    }).select().single()

    if (error) return NextResponse.json({ error: error.message }, { status: 400 })
    return NextResponse.json({ client: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const id = searchParams.get('id')
    if (!id) return NextResponse.json({ error: '缺少 id 参数' }, { status: 400 })

    const supabase = getSupabaseAdminClient()

    // Check if client has todos - warn but allow deletion
    const { count } = await supabase.from('todos')
      .select('*', { count: 'exact', head: true }).eq('customer_code',
        // get customer_code first
        (await supabase.from('oms_clients').select('customer_code').eq('id', id).single()).data?.customer_code ?? ''
      )

    // Delete the client
    const { error } = await supabase.from('oms_clients').delete().eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })

    return NextResponse.json({ success: true, message: `客户已删除`, relatedTodos: count ?? 0 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const { id, customer_code, customer_name, oms_account, company_name } = await req.json()
    if (!id) return NextResponse.json({ error: '缺少 id' }, { status: 400 })
    if (!customer_code || !customer_name) return NextResponse.json({ error: '客户代码和名称必填' }, { status: 400 })

    const supabase = getSupabaseAdminClient()

    // Check duplicate customer_code (exclude self)
    const { data: existing } = await supabase.from('oms_clients')
      .select('id').eq('customer_code', customer_code.trim()).neq('id', id).maybeSingle()
    if (existing) return NextResponse.json({ error: `客户代码 ${customer_code} 已被其他客户使用` }, { status: 409 })

    const { error } = await supabase.from('oms_clients').update({
      customer_code: customer_code.trim(),
      customer_name: customer_name.trim(),
      oms_account:   oms_account?.trim() ?? '',
      company_name:  company_name?.trim() ?? '',
    }).eq('id', id)

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true, message: '客户信息已更新' })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
