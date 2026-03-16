/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

export async function GET() {
  try {
    const supabase = getSupabaseAdminClient()
    const { data: clients } = await supabase.from('oms_clients')
      .select('id,customer_code,customer_name,app_key,app_secret,auth_status')
      .eq('auth_status', 1).limit(1)
    if (!clients?.length) return NextResponse.json({ error: 'no bound client' })

    const client    = clients[0]
    const appKey    = decrypt(client.app_key)
    const appSecret = decrypt(client.app_secret)

    // Fetch outbound pageList - show FULL raw response
    const listData = { page: 1, pageSize: 2 }
    const listTime = String(Math.floor(Date.now()/1000))
    const listAuth = generateAuthcode(appKey, appSecret, listTime, listData)
    const listRes  = await fetch(`${API_BASE}/v1/outboundOrder/pageList?authcode=${listAuth}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({appKey, data:listData, reqTime:listTime})
    })
    const rawList = await listRes.json()

    // Try detail API with first order if we have one
    const records = rawList?.data?.records ?? rawList?.data ?? []
    const firstNo = records[0]?.outboundOrderNo
    let rawDetail: any = null
    if (firstNo) {
      const dData = { outboundOrderNoList: [firstNo] }
      const dTime = String(Math.floor(Date.now()/1000))
      const dAuth = generateAuthcode(appKey, appSecret, dTime, dData)
      const dRes  = await fetch(`${API_BASE}/v1/outboundOrder/detail?authcode=${dAuth}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({appKey, data:dData, reqTime:dTime})
      })
      rawDetail = await dRes.json()
    }

    // DB sample
    const { data: dbSample } = await supabase.from('todos')
      .select('lingxing_order_no,extra_data,description')
      .eq('category','出库作业').limit(2)

    return NextResponse.json({
      // Show FULL raw API responses - no processing
      RAW_pageList_full_response: rawList,
      RAW_detail_full_response: rawDetail,
      // DB state
      db_sample: dbSample,
    })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
