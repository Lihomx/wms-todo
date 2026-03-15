/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { encrypt } from '@/lib/crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

export async function POST(req: NextRequest) {
  try {
    const { clientId, appKey, appSecret } = await req.json()
    if (!clientId || !appKey || !appSecret) return NextResponse.json({ error: '参数不完整' }, { status: 400 })

    // Verify credentials by calling warehouse options
    const reqTime  = String(Math.floor(Date.now()/1000))
    const authcode = generateAuthcode(appKey, appSecret, reqTime, {})
    const res = await fetch(`${API_BASE}/v1/warehouse/options?authcode=${authcode}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ appKey, reqTime }),
    })
    const json = await res.json()
    const code = json.code ?? json.status
    const ok   = code===200||code===0||code==='200'||code==='0'

    const supabase = getSupabaseAdminClient()
    const warehouses = ok ? (Array.isArray(json.data)?json.data:(json.data?.list??[])) : []
    const warehouseIds = warehouses.map((w:any)=>String(w.whCode??''))

    await supabase.from('oms_clients').update({
      app_key:       encrypt(appKey),
      app_secret:    encrypt(appSecret),
      auth_status:   ok ? 1 : 2,
      warehouse_ids: warehouseIds,
      sync_enabled:  ok,
    }).eq('id', clientId)

    if (!ok) return NextResponse.json({ error: `OMS验证失败: code=${code} ${json.message??json.msg??''}` }, { status: 400 })
    return NextResponse.json({ success: true, message: `✅ 绑定成功！检测到 ${warehouses.length} 个仓库`, warehouseCount: warehouses.length })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
