import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

  // 1. Count ALL todos (no filter)
  const { count: totalAll } = await supabase.from('todos').select('*', { count: 'exact', head: true })

  // 2. Count by tenant
  const { count: totalByTenant } = await supabase.from('todos').select('*', { count: 'exact', head: true }).eq('tenant_id', DEFAULT_TENANT)

  // 3. Get distinct tenant_ids
  const { data: tenants } = await supabase.from('todos').select('tenant_id').limit(10)
  const distinctTenants = [...new Set((tenants ?? []).map((r: any) => r.tenant_id))]

  // 4. Get first 3 rows
  const { data: sample, error } = await supabase.from('todos').select('id,title,tenant_id,category,status,source').limit(3)

  return NextResponse.json({
    DEFAULT_TENANT,
    totalAll,
    totalByTenant,
    distinctTenants,
    sample,
    sampleError: error?.message,
  })
}
