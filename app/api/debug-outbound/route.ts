/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

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

    // 1. Fetch pageList (3 records)
    const listData    = { page: 1, pageSize: 3 }
    const listTime    = String(Math.floor(Date.now()/1000))
    const listAuth    = generateAuthcode(appKey, appSecret, listTime, listData)
    const listRes     = await fetch(`${API_BASE}/v1/outboundOrder/pageList?authcode=${listAuth}`, {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({appKey, data:listData, reqTime:listTime})
    })
    const listJson = await listRes.json()
    const records  = listJson.data?.records ?? listJson.data ?? []
    const first    = records[0]

    // 2. Fetch detail for first order
    let detailFirst: any = null
    if (first?.outboundOrderNo) {
      const dData = { outboundOrderNoList: [first.outboundOrderNo] }
      const dTime = String(Math.floor(Date.now()/1000))
      const dAuth = generateAuthcode(appKey, appSecret, dTime, dData)
      const dRes  = await fetch(`${API_BASE}/v1/outboundOrder/detail?authcode=${dAuth}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({appKey, data:dData, reqTime:dTime})
      })
      const dJson = await dRes.json()
      detailFirst = dJson.data?.[0] ?? dJson.data
    }

    // 3. Also show existing extra_data in DB
    const { data: dbTodos } = await supabase.from('todos')
      .select('lingxing_order_no,extra_data')
      .eq('category','出库作业')
      .not('extra_data', 'is', null)
      .limit(2)

    return NextResponse.json({
      client: client.customer_code,
      // Raw pageList fields
      pageList_keys: first ? Object.keys(first) : [],
      pageList_first: first,
      // Detail fields
      detail_keys: detailFirst ? Object.keys(detailFirst) : [],
      detail_first: detailFirst,
      // DB extra_data sample
      db_extra_data_sample: dbTodos?.[0]?.extra_data ?? 'empty',
    })
  } catch (err:any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
