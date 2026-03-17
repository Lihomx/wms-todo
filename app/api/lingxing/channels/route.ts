/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  const whCode = new URL(req.url).searchParams.get('whCode') || 'LIHO'
  const supabase = getSupabaseAdminClient()
  const { data: cred } = await supabase.from('lingxing_credentials')
    .select('app_key,app_secret,auth_status').eq('tenant_id', DEFAULT_TENANT).single()
  if (!cred?.auth_status) return NextResponse.json({ channels: [] })

  const appKey    = decrypt(cred.app_key)
  const appSecret = decrypt(cred.app_secret)
  const reqTime   = String(Math.floor(Date.now()/1000))
  const data      = { whCode, current: 1, size: 100 }
  const authcode  = generateAuthcode(appKey, appSecret, reqTime, data)

  const res  = await fetch(`${API_BASE}/openapi/logistics/channel/list?authcode=${authcode}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey, data, reqTime })
  })
  const json = await res.json()
  const channels = json.data?.list ?? json.data ?? []
  return NextResponse.json({ channels: channels.map((c:any)=>({channelCode:c.channelCode,channelName:c.channelName,carrierName:c.carrierName})) })
}
