// One-time setup: hash the admin password if stored as plain text
import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { createHmac, randomBytes } from 'crypto'

export async function GET() {
  const sb = getSupabaseAdminClient()
  const { data } = await sb.from('jt_config').select('v').eq('k','admin_password').single()
  const pwd = data?.v || ''
  // If not already hashed (no dot separator for salt)
  if (pwd && !pwd.includes('.')) {
    const salt = randomBytes(16).toString('hex')
    const hash = createHmac('sha256', salt).update(pwd).digest('hex')
    await sb.from('jt_config').update({ v: `${hash}.${salt}` }).eq('k','admin_password')
    return NextResponse.json({ done: true, msg: 'Password hashed successfully' })
  }
  return NextResponse.json({ done: false, msg: 'Already hashed or no password set' })
}
