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
      .eq('auth_status', 1).limit(3)
    if (!clients?.length) return NextResponse.json({ error: 'no bound client' })

    const results: any[] = []

    for (const client of clients) {
      const appKey    = decrypt(client.app_key)
      const appSecret = decrypt(client.app_secret)
      
      // Fetch 10 outbound records
      const listData = { page: 1, pageSize: 10 }
      const listTime = String(Math.floor(Date.now()/1000))
      const listAuth = generateAuthcode(appKey, appSecret, listTime, listData)
      const listRes  = await fetch(`${API_BASE}/v1/outboundOrder/pageList?authcode=${listAuth}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({appKey, data:listData, reqTime:listTime})
      })
      const listJson = await listRes.json()
      const records  = listJson.data?.records ?? []

      // Fetch detail for first order to see productList/receiver
      let firstDetail: any = null
      const firstNo = records[0]?.outboundOrderNo
      if (firstNo) {
        const dData = { outboundOrderNoList: [firstNo] }
        const dTime = String(Math.floor(Date.now()/1000))
        const dAuth = generateAuthcode(appKey, appSecret, dTime, dData)
        const dRes  = await fetch(`${API_BASE}/v1/outboundOrder/detail?authcode=${dAuth}`, {
          method:'POST', headers:{'Content-Type':'application/json'},
          body: JSON.stringify({appKey, data:dData, reqTime:dTime})
        })
        const dJson = await dRes.json()
        firstDetail = dJson.data?.[0]
      }

      results.push({
        customer: client.customer_code,
        // Show platform code → order number for manual mapping
        platform_mapping_clues: records.map((r:any) => ({
          orderNo: r.outboundOrderNo,
          salesPlatform_CODE: r.salesPlatform,
          platformOrderNo: r.platformOrderNo,
          logisticsTrackNo: r.logisticsTrackNo,
          logisticsChannel: r.logisticsChannel,
          receiver: r.receiver,
        })),
        // Show FULL detail for first order
        first_detail_ALL_FIELDS: firstDetail,
        detail_productList: firstDetail?.productList,
        detail_expressList: firstDetail?.expressList,
        total_in_api: listJson.data?.total,
      })
    }

    // Also show DB state
    const { data: dbSample } = await supabase.from('todos')
      .select('lingxing_order_no,extra_data')
      .eq('category','出库作业')
      .not('extra_data', 'eq', '{}')
      .limit(2)

    return NextResponse.json({ results, db_sample_with_extra_data: dbSample })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
