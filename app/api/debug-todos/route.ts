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
      .eq('auth_status', 1)

    if (!clients?.length) return NextResponse.json({ error: 'no bound clients' })

    const results = []
    for (const client of clients) {
      const appKey    = decrypt(client.app_key)
      const appSecret = decrypt(client.app_secret)

      // 1. pageList - 3 records
      const listData = { page: 1, pageSize: 3 }
      const listTime = String(Math.floor(Date.now()/1000))
      const listAuth = generateAuthcode(appKey, appSecret, listTime, listData)
      const listRes  = await fetch(`${API_BASE}/v1/outboundOrder/pageList?authcode=${listAuth}`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({appKey, data:listData, reqTime:listTime})
      })
      const listJson = await listRes.json()
      const records  = listJson.data?.records ?? listJson.data ?? []
      const first    = records[0]

      // 2. detail for first order
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

      // 3. DB extra_data for this order
      let dbExtraData = null
      if (first?.outboundOrderNo) {
        const { data: todo } = await supabase.from('todos')
          .select('extra_data')
          .eq('lingxing_order_no', first.outboundOrderNo)
          .single()
        dbExtraData = todo?.extra_data
      }

      results.push({
        customer:             client.customer_code,
        platform_mapping_clues: records.slice(0,10).map((r:any)=>({
          orderNo: r.outboundOrderNo,
          salesPlatform_CODE: r.salesPlatform,
          platformOrderNo: r.platformOrderNo,
          logisticsTrackNo: r.logisticsTrackNo,
          logisticsChannel: r.logisticsChannel,
        })),
        first_detail_ALL_FIELDS: detailFirst,
        detail_productList:  detailFirst?.productList,
        detail_expressList:  detailFirst?.expressList,
        db_extra_data: dbExtraData,
        total_in_api:        listJson.data?.total ?? 0,
      })
    }

    // Also check DB sample
    const { data: dbSample } = await supabase.from('todos')
      .select('lingxing_order_no,extra_data,description')
      .eq('category','出库作业')
      .not('extra_data->logisticsTrackNo','is','null')
      .limit(3)

    return NextResponse.json({ results, db_sample_with_extra_data: dbSample })
  } catch (err:any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
