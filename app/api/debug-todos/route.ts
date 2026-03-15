import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

  // 1. Try a direct insert and see the error
  const testInsert = await supabase.from('todos').insert({
    tenant_id:         DEFAULT_TENANT,
    title:             'TEST_DEBUG_ENTRY',
    category:          '退货处理',
    priority:          1,
    status:            0,
    source:            'lingxing_auto',
    lingxing_order_no: 'test_debug_001',
    description:       'debug test',
  }).select()

  // 2. Count after insert attempt
  const { count: totalAfter } = await supabase.from('todos').select('*', { count: 'exact', head: true })

  // 3. Check if lingxing_credentials has data
  const { data: creds } = await supabase.from('lingxing_credentials').select('tenant_id,auth_status,warehouse_ids').limit(5)

  // 4. Check tenants table
  const { data: tenants } = await supabase.from('tenants').select('id,name').limit(5)

  return NextResponse.json({
    DEFAULT_TENANT,
    insertResult: { data: testInsert.data, error: testInsert.error?.message, status: testInsert.status },
    totalAfterInsert: totalAfter,
    credentials: creds,
    tenants,
  })
}
