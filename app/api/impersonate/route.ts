import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { randomBytes } from 'crypto'

// POST: warehouse admin generates a token to access a client portal
export async function POST(req: NextRequest) {
  const { customerCode } = await req.json()
  if (!customerCode) return NextResponse.json({ error: 'customerCode required' }, { status: 400 })

  const supabase = getSupabaseAdminClient()

  // Get client info
  const { data: client } = await supabase.from('oms_clients')
    .select('customer_code, customer_name, auth_status')
    .eq('customer_code', customerCode)
    .single()

  if (!client) return NextResponse.json({ error: '客户不存在' }, { status: 404 })

  // Generate a secure random token (32 bytes hex)
  const token = randomBytes(32).toString('hex')
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000) // 5 minutes

  // Clean up old tokens for this customer
  await supabase.from('impersonate_tokens')
    .delete()
    .eq('customer_code', customerCode)

  // Store token
  const { error } = await supabase.from('impersonate_tokens').insert({
    token,
    customer_code: customerCode,
    customer_name: client.customer_name,
    expires_at:    expiresAt.toISOString(),
  })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ token, expiresAt })
}

// GET: validate token and return customer info (used by client login page)
export async function GET(req: NextRequest) {
  const token = new URL(req.url).searchParams.get('token')
  if (!token) return NextResponse.json({ error: 'token required' }, { status: 400 })

  const supabase = getSupabaseAdminClient()

  const { data, error } = await supabase.from('impersonate_tokens')
    .select('*')
    .eq('token', token)
    .eq('used', false)
    .single()

  if (error || !data) return NextResponse.json({ error: '无效或已过期的令牌' }, { status: 401 })

  // Check expiry
  if (new Date(data.expires_at) < new Date()) {
    await supabase.from('impersonate_tokens').delete().eq('token', token)
    return NextResponse.json({ error: '令牌已过期，请重新点击进入' }, { status: 401 })
  }

  // Mark as used
  await supabase.from('impersonate_tokens').update({ used: true }).eq('token', token)

  return NextResponse.json({
    customerCode: data.customer_code,
    customerName: data.customer_name,
  })
}
