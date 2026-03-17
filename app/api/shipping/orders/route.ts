import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const page     = Number(searchParams.get('page') || 1)
  const pageSize = Number(searchParams.get('pageSize') || 50)
  const customer = searchParams.get('customer') || ''

  const supabase = getSupabaseAdminClient()
  let query = supabase.from('shipping_orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range((page-1)*pageSize, page*pageSize-1)

  if (customer) query = query.eq('customer_code', customer)

  const { data, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ orders: data ?? [], total: count ?? 0 })
}
