import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase.from('warehouse_settings').select('key,value')
  const settings: Record<string,string> = {}
  for (const row of data ?? []) settings[row.key] = row.value ?? ''
  return NextResponse.json({ settings })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = getSupabaseAdminClient()
  for (const [key, value] of Object.entries(body)) {
    await supabase.from('warehouse_settings')
      .upsert({ key, value: String(value) }, { onConflict: 'key' })
  }
  return NextResponse.json({ success: true })
}
