import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('oms_clients')
    .select('*')
    .order('customer_code', { ascending: true })
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ clients: data ?? [] })
}
