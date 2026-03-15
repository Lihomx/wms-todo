import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { decrypt } from '@/lib/crypto'

export async function GET() {
  const supabase = getSupabaseAdminClient()

  // Check oms_clients columns and data
  const { data: clients, error: ce } = await supabase
    .from('oms_clients')
    .select('id,customer_code,customer_name,auth_status,app_key,app_secret,last_synced_at')
    .limit(5)

  // Check todos without customer_code
  const { count: noClient } = await supabase
    .from('todos')
    .select('*', { count: 'exact', head: true })
    .is('customer_code', null)

  // Check todos with customer_code
  const { data: withClient } = await supabase
    .from('todos')
    .select('customer_code')
    .not('customer_code', 'is', null)
    .limit(5)

  // Try decrypt if app_key exists
  let decryptTest = null
  if (clients?.[0]?.app_key) {
    try {
      const dk = decrypt(clients[0].app_key)
      decryptTest = { len: dk.length, prefix: dk.slice(0,6)+'...' }
    } catch(e: any) {
      decryptTest = { error: e.message }
    }
  }

  return NextResponse.json({
    oms_clients: clients ?? [],
    oms_clients_error: ce?.message,
    todos_without_customer_code: noClient,
    todos_with_client_sample: withClient,
    decrypt_test: decryptTest,
  })
}
