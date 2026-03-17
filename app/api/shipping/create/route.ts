/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE       = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  const { data } = await supabase.from('warehouse_settings').select('key,value')
  const settings: Record<string, string> = {}
  for (const row of data ?? []) settings[row.key] = row.value ?? ''
  return NextResponse.json({ origin: settings })
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const {
      dest, pkg, logisticsChannel, customerCode,
      sku, skuQty,
      // New optional fields
      salesPlatform, storeName, platformOrderNo, referOrderNo,
      signatureService, remark,
    } = body

    if (!dest?.name || !dest?.phone || !dest?.address || !dest?.cp || !dest?.colonia || !dest?.city || !pkg?.weight) {
      return NextResponse.json({ error: '请填写所有必填字段' }, { status: 400 })
    }
    if (!customerCode) return NextResponse.json({ error: '缺少 customerCode' }, { status: 400 })

    const supabase = getSupabaseAdminClient()

    // Get THIS customer's credentials
    const { data: clientData } = await supabase.from('oms_clients')
      .select('id,customer_code,customer_name,app_key,app_secret,auth_status')
      .eq('customer_code', customerCode).eq('auth_status', 1).single()

    if (!clientData?.app_key) {
      return NextResponse.json({ error: `客户 ${customerCode} 未绑定AppKey` }, { status: 401 })
    }

    // Get warehouse settings
    const { data: wsData } = await supabase.from('warehouse_settings').select('key,value')
    const ws: Record<string, string> = {}
    for (const r of wsData ?? []) ws[r.key] = r.value ?? ''

    const appKey    = decrypt(clientData.app_key)
    const appSecret = decrypt(clientData.app_secret)
    const whCode    = ws.wh_code || 'LIHO'

    // Build sender name: "ZHENYUAN LI (A17)"
    const originName = `${ws.origin_name || 'ZHENYUAN LI'} (${customerCode})`

    const thirdOrderNo = `WMS${customerCode}${Date.now()}`

    const omsOrder: Record<string, any> = {
      whCode,
      thirdOrderNo,
      subOrderType:      1,
      logisticsChannel:  logisticsChannel || 'Upload_Shipping_Label',
      receiver:          dest.name,
      telephone:         dest.phone,
      email:             dest.email || '',
      countryRegionCode: 'MX',
      provinceName:      dest.state,
      provinceCode:      dest.provinceCode || 'MX',
      cityName:          dest.city,
      postCode:          dest.cp,
      addressOne:        dest.address,
      addressTwo:        dest.colonia,
      productList: [{
        sku:      sku      || 'DEFAULT-SKU',
        quantity: Number(skuQty) || 1,
      }],
      // Optional fields
      ...(salesPlatform   && { salesPlatform }),
      ...(storeName       && { store: storeName }),
      ...(platformOrderNo && { platformOrderNo }),
      ...(referOrderNo    && { referOrderNo }),
      ...(signatureService && { signatureService: Number(signatureService) }),
      remark: remark || pkg.content || '',
    }

    const reqTime  = String(Math.floor(Date.now() / 1000))
    const authcode = generateAuthcode(appKey, appSecret, reqTime, [omsOrder])

    const omsRes = await fetch(`${API_BASE}/v1/outboundOrder/create?authcode=${authcode}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appKey, data: [omsOrder], reqTime }),
    })
    const omsJson = await omsRes.json()

    const results     = omsJson.data ?? []
    const orderResult = Array.isArray(results) ? results[0] : results
    const success     = orderResult?.success === true
    const outboundNo  = orderResult?.orderNo ?? ''
    const errMsg      = orderResult?.msg ?? omsJson.message ?? omsJson.msg ?? ''

    // Save to DB
    const { data: saved } = await supabase.from('shipping_orders').insert({
      tenant_id:         DEFAULT_TENANT,
      customer_code:     clientData.customer_code,
      customer_name:     clientData.customer_name,
      origin_name:       originName,
      origin_phone:      ws.origin_phone   || '',
      origin_email:      ws.origin_email   || '',
      origin_company:    ws.origin_company || '',
      origin_address:    ws.origin_address || '',
      origin_cp:         ws.origin_cp      || '',
      origin_colonia:    ws.origin_colonia || '',
      origin_city:       ws.origin_city    || '',
      origin_state:      ws.origin_state   || '',
      dest_name:         dest.name,
      dest_phone:        dest.phone,
      dest_email:        dest.email    || '',
      dest_address:      dest.address,
      dest_cp:           dest.cp,
      dest_colonia:      dest.colonia,
      dest_city:         dest.city,
      dest_state:        dest.state,
      pkg_content:       pkg.content   || '',
      pkg_length:        Number(pkg.length)  || null,
      pkg_width:         Number(pkg.width)   || null,
      pkg_height:        Number(pkg.height)  || null,
      pkg_weight:        Number(pkg.weight),
      logistics_channel: logisticsChannel || '',
      outbound_order_no: outboundNo,
      oms_status:        success ? 'success' : 'failed',
      oms_error:         success ? null : errMsg,
      oms_response:      omsJson,
    }).select('id').single()

    if (!success) {
      return NextResponse.json({
        error:       `领星创建失败: ${errMsg || JSON.stringify(omsJson)}`,
        localId:     saved?.id,
        rawResponse: omsJson,
      }, { status: 400 })
    }

    return NextResponse.json({ success: true, outboundOrderNo: outboundNo, thirdOrderNo, localId: saved?.id })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
