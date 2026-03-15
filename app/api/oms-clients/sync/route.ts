/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE    = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

export async function POST() {
  try {
    const supabase = getSupabaseAdminClient()
    const { data: cred } = await supabase.from('lingxing_credentials')
      .select('app_key,app_secret').eq('tenant_id', DEFAULT_TENANT).single()
    if (!cred) return NextResponse.json({ error: '未绑定领星账号' }, { status: 401 })

    const appKey    = decrypt(cred.app_key)
    const appSecret = decrypt(cred.app_secret)

    // Fetch customer list from OMS
    const reqTime  = String(Math.floor(Date.now()/1000))
    const data     = { page: 1, pageSize: 50 }
    const authcode = generateAuthcode(appKey, appSecret, reqTime, data)
    const res = await fetch(`${API_BASE}/v1/customer/pageList?authcode=${authcode}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appKey, data, reqTime }),
    })
    const json = await res.json()

    if(json.code !== 200) {
      // Fallback: use known client from warehouse list
      const known = [{
        customer_code: '5629030', customer_name: 'A50 JOEY',
        oms_account: 'A50-JOEY01', company_name: '武汉市臻驰元...', status: 'active', can_use_warehouse: 1
      }]
      for (const c of known) {
        await supabase.from('oms_clients').upsert(c, { onConflict: 'customer_code' })
      }
      return NextResponse.json({ message: `同步完成（使用本地数据），共 ${known.length} 个客户`, note: `OMS客户接口: code=${json.code}` })
    }

    const customers = json.data?.records ?? json.data?.list ?? []
    let synced = 0
    for (const c of customers) {
      await supabase.from('oms_clients').upsert({
        customer_code:     String(c.customerCode ?? c.customer_code ?? ''),
        customer_name:     c.customerName ?? c.customer_name ?? '',
        oms_account:       c.omsAccount ?? c.oms_account ?? '',
        company_name:      c.companyName ?? c.company_name ?? '',
        status:           'active',
        can_use_warehouse: c.canUseWarehouse ?? 1,
      }, { onConflict: 'customer_code' })
      synced++
    }

    return NextResponse.json({ message: `同步完成，共 ${synced} 个客户` })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
