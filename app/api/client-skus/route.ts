/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const customerCode = searchParams.get('customerCode')
  const search       = searchParams.get('search') || ''

  if (!customerCode) return NextResponse.json({ error: 'customerCode required' }, { status: 400 })

  const supabase = getSupabaseAdminClient()
  const { data: client } = await supabase.from('oms_clients')
    .select('app_key,app_secret,auth_status')
    .eq('customer_code', customerCode).eq('auth_status', 1).single()

  if (!client?.app_key) return NextResponse.json({ error: '未绑定AppKey' }, { status: 401 })

  const appKey    = decrypt(client.app_key)
  const appSecret = decrypt(client.app_secret)
  const reqTime   = String(Math.floor(Date.now() / 1000))
  const data: any = { page: 1, pageSize: 100, approveStatus: 2 } // only approved SKUs
  if (search) data.skuList = [search]

  const authcode = generateAuthcode(appKey, appSecret, reqTime, data)
  const res = await fetch(`${API_BASE}/v1/product/pageList?authcode=${authcode}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey, data, reqTime })
  })
  const json = await res.json()
  const records = json.data?.records ?? json.data ?? []

  return NextResponse.json({
    skus: records.map((p: any) => ({
      sku:         p.sku,
      productName: p.productName,
      mainCode:    p.mainCode,
    }))
  })
}
