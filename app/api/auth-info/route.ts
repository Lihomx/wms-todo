import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function GET() {
  // Get current user from session
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { get: (name) => cookieStore.get(name)?.value } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ role: 'guest' })

  const admin = getSupabaseAdminClient()
  
  // Check if warehouse admin (no client_account entry)
  const { data: clientAcc } = await admin.from('client_accounts')
    .select('customer_code, display_name, is_active, oms_clients(customer_name)')
    .eq('id', user.id).single()

  if (clientAcc) {
    return NextResponse.json({
      role:         'client',
      userId:       user.id,
      email:        user.email,
      displayName:  clientAcc.display_name,
      customerCode: clientAcc.customer_code,
      customerName: (clientAcc.oms_clients as any)?.customer_name,
      isActive:     clientAcc.is_active,
    })
  }

  return NextResponse.json({
    role:  'warehouse_admin',
    userId: user.id,
    email:  user.email,
  })
}
