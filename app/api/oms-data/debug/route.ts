import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { decrypt } from '@/lib/crypto'
import { generateAuthcode } from '@/lib/lingxing'

const API_BASE = 'https://api.xlwms.com/openapi'

export async function GET(req: NextRequest) {
  const customerCode = new URL(req.url).searchParams.get('cc') || ''
  const supabase = getSupabaseAdminClient()

  // 1. All clients summary (no sensitive data)
  const { data: all } = await supabase.from('oms_clients')
    .select('id,customer_code,customer_name,auth_status,app_key')
  const clientsSummary = (all||[]).map(c=>({
    code: JSON.stringify(c.customer_code), // stringify to show any whitespace
    name: c.customer_name,
    auth_status: c.auth_status,
    has_key: !!c.app_key,
    key_len: c.app_key?.length
  }))

  // 2. Try exact match for requested code
  let credTest = null
  if (customerCode) {
    const { data: client } = await supabase.from('oms_clients')
      .select('app_key,app_secret,auth_status')
      .eq('customer_code', customerCode).eq('auth_status', 1).single()
    
    if (client?.app_key) {
      const appKey    = decrypt(client.app_key)
      const appSecret = decrypt(client.app_secret)
      const reqTime   = String(Math.floor(Date.now()/1000))
      // Test warehouse options (known to work)
      const ac = generateAuthcode(appKey, appSecret, reqTime, {})
      const r1 = await fetch(`${API_BASE}/v1/warehouse/options?authcode=${ac}`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({appKey, reqTime})
      })
      const j1 = await r1.json()
      // Test product list
      const d2 = {page:1, pageSize:5, approveStatus:2}
      const ac2 = generateAuthcode(appKey, appSecret, String(Math.floor(Date.now()/1000)), d2)
      const r2 = await fetch(`${API_BASE}/v1/product/pageList?authcode=${ac2}`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({appKey, data:d2, reqTime:String(Math.floor(Date.now()/1000))})
      })
      const j2 = await r2.json()
      // Test inventory
      const today = new Date().toISOString().split('T')[0]
      const start = new Date(Date.now()-30*864e5).toISOString().split('T')[0]
      const d3 = {page:1, pageSize:5, startTime:`${start} 00:00:00`, endTime:`${today} 23:59:59`}
      const ac3 = generateAuthcode(appKey, appSecret, String(Math.floor(Date.now()/1000)), d3)
      const r3 = await fetch(`${API_BASE}/v1/integratedInventory/pageOpen?authcode=${ac3}`,{
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({appKey, data:d3, reqTime:String(Math.floor(Date.now()/1000))})
      })
      const j3 = await r3.json()
      credTest = {
        appKeyPrefix: appKey.slice(0,8)+'...',
        warehouse: {code:j1.code, msg:j1.message||j1.msg, count:j1.data?.length},
        products:  {code:j2.code, msg:j2.message||j2.msg, total:j2.data?.total},
        inventory: {code:j3.code, msg:j3.message||j3.msg, total:j3.data?.total},
      }
    } else {
      credTest = { error: 'credentials not found for this customerCode', auth_status: (all||[]).find(c=>c.customer_code===customerCode)?.auth_status }
    }
  }

  return NextResponse.json({ all_clients: clientsSummary, test: credTest })
}
