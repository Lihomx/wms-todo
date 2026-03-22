/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { createHmac, randomBytes, timingSafeEqual } from 'crypto'

const JT_API_BASE = 'http://jthq.rtb56.com/webservice/PublicService.asmx/ServiceInterfaceUTF8'

// ─── helpers ─────────────────────────────────────────────
function ok(data: any = {})       { return NextResponse.json({ success: 1, data }) }
function err(msg: string, s = 400) { return NextResponse.json({ success: 0, msg }, { status: s }) }

async function cfgGet(k: string) {
  const { data } = await getSupabaseAdminClient().from('jt_config').select('v').eq('k', k).single()
  return data?.v ?? ''
}
async function cfgSet(k: string, v: string) {
  await getSupabaseAdminClient().from('jt_config').upsert({ k, v }, { onConflict: 'k' })
}

async function jtCall(method: string, params: object) {
  const [token, key] = await Promise.all([cfgGet('app_token'), cfgGet('app_key')])
  if (!token || !key) return { success: 0, cnmessage: 'API Token/Key未配置，请在极兔设置页面配置' }
  const body = new URLSearchParams({
    appToken: token, appKey: key,
    serviceMethod: method,
    paramsJson: JSON.stringify(params),
  })
  try {
    const res = await fetch(JT_API_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': 'JituWMS/2.0' },
      body: body.toString(),
      signal: AbortSignal.timeout(30000),
    })
    return await res.json()
  } catch (e: any) {
    return { success: 0, cnmessage: '无法连接J&T服务器: ' + e.message }
  }
}

function hashPassword(password: string) {
  const salt = randomBytes(16).toString('hex')
  const hash = createHmac('sha256', salt).update(password).digest('hex')
  return `${hash}.${salt}`
}
function verifyPassword(password: string, stored: string) {
  if (!stored) return false
  if (!stored.includes('.')) return password === stored  // plain text fallback
  const [hash, salt] = stored.split('.')
  try {
    const attempt = createHmac('sha256', salt).update(password).digest('hex')
    return timingSafeEqual(Buffer.from(hash), Buffer.from(attempt))
  } catch { return false }
}

// ─── main handler ─────────────────────────────────────────
// Auth: uses existing WMS sessions - NO separate JT login needed
// Headers sent by client pages:
//   x-wms-role: 'admin' (warehouse) or 'client' (OMS client)
//   x-customer-code: customer code for client role
export async function POST(req: NextRequest) {
  const action       = new URL(req.url).searchParams.get('action') || ''
  const body         = await req.json().catch(() => ({}))
  const sb           = getSupabaseAdminClient()
  const role         = req.headers.get('x-wms-role') || 'client'
  const customerCode = req.headers.get('x-customer-code') || body.client_code || ''
  const isAdmin      = role === 'admin'

  // ── Orders ───────────────────────────────────────────────
  if (action === 'create_order') {
    const o   = body.order || {}
    const ref = (o.reference_no || '').trim().replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 50)
    if (!ref) return err('reference_no必填')
    const allowed = ['reference_no','client_code','client_name','consignee_name','consignee_company',
      'consignee_phone','consignee_postcode','consignee_colonia','shipping_city','shipping_state',
      'consignee_street','consignee_interior','consignee_reference','weight','pieces',
      'largo','ancho','alto','cargo_type','cargo_content','notes','pkg_notes','items']
    const safe: any = {}
    for (const k of allowed) if (o[k] !== undefined) safe[k] = o[k]
    const { error } = await sb.from('jt_orders').upsert({
      id: 'ord_' + Date.now(), reference_no: ref, data: safe, status: 'reviewing',
      client_code: safe.client_code || customerCode || '',
      client_name: safe.client_name || '',
    }, { onConflict: 'reference_no' })
    if (error) return err('创建失败: ' + error.message)
    // Auto-save address
    if (o.consignee_name && o.consignee_postcode) {
      const cc    = safe.client_code || customerCode || ''
      const alias = `${o.consignee_name} - CP ${(o.consignee_postcode||'').replace(/\D/g,'')}`
      const { data: ex } = await sb.from('jt_addresses').select('id').eq('client_code',cc).eq('alias',alias).maybeSingle()
      if (!ex) await sb.from('jt_addresses').insert({
        id:'addr_'+Date.now(), client_code:cc, alias,
        name:o.consignee_name, company:o.consignee_company||'',
        phone:o.consignee_phone, postcode:(o.consignee_postcode||'').replace(/\D/g,''),
        colonia:o.consignee_colonia, city:o.shipping_city, state:o.shipping_state,
        street:o.consignee_street, interior:o.consignee_interior||'', reference:o.consignee_reference||'',
      })
    }
    return ok({ reference_no: ref, status: 'reviewing' })
  }

  if (action === 'get_orders') {
    let q = sb.from('jt_orders').select('*').order('created_at', { ascending: false })
    if (!isAdmin) q = q.eq('client_code', customerCode).limit(500)
    else q = q.limit(1000)
    const { data } = await q
    return ok(data || [])
  }

  if (action === 'delete_order') {
    if (!isAdmin) return err('无权限', 403)
    const ref = body.reference_no
    const jt  = await jtCall('removeorder', { reference_no: ref })
    await sb.from('jt_orders').update({ status:'deleted', sync_error:`J&T:${jt.success==1?'成功':(jt.cnmessage||'?')}` }).eq('reference_no', ref)
    return ok({ jt })
  }

  if (action === 'update_order') {
    if (!isAdmin) return err('无权限', 403)
    const { reference_no: ref, status, tracking_no, weight } = body
    if (weight > 0) await jtCall('updateorder', { reference_no: ref, order_weight: weight })
    await sb.from('jt_orders').update({ status, tracking_no: tracking_no||'' }).eq('reference_no', ref)
    return ok()
  }

  if (action === 'get_tracking') {
    const ref = body.reference_no
    const jt  = await jtCall('gettrackingnumber', { reference_no: ref })
    if (jt.success == 1) {
      const track = jt.data?.channel_hawbcode || jt.data?.shipping_method_no || ''
      await sb.from('jt_orders').update({ tracking_no: track, status:'synced' }).eq('reference_no', ref)
    }
    return ok(jt)
  }

  if (action === 'submit_to_jt') {
    if (!isAdmin) return err('无权限', 403)
    const ref = body.reference_no
    const { data: row } = await sb.from('jt_orders').select('*').eq('reference_no', ref).single()
    if (!row)                return err('订单不存在')
    if (row.status==='synced') return err('该订单已同步')
    if (row.status==='deleted')return err('该订单已删除')
    const od: any = { ...(row.data as any) }
    if (body.order_data) Object.assign(od, body.order_data)
    const shipperJson = await cfgGet('shipper')
    const shipper     = JSON.parse(shipperJson || '{}')
    const params = {
      reference_no:    ref,
      shipping_method: await cfgGet('shipping_method') || 'JT-MX-CD-N',
      order_weight:    Math.max(0.01, parseFloat(od.weight||'0.2')),
      order_pieces:    Math.max(1,    parseInt(od.pieces||'1')),
      mail_cargo_type: ['1','2','3','4'].includes(od.cargo_type)?od.cargo_type:'4',
      order_info:      (od.notes||'').slice(0,200),
      consignee: {
        consignee_name:        (od.consignee_name   ||'').slice(0,200),
        consignee_company:     (od.consignee_company||'').slice(0,200),
        consignee_countrycode: 'MX',
        consignee_province:    (od.shipping_state   ||'').slice(0,100),
        consignee_city:        (od.shipping_city    ||'').slice(0,100),
        consignee_district:    (od.consignee_colonia||'').slice(0,200),
        consignee_street:      (od.consignee_street ||'').slice(0,300),
        consignee_postcode:    (od.consignee_postcode||'').replace(/\D/g,''),
        consignee_telephone:   (od.consignee_phone  ||'').replace(/[^0-9+\-()\s]/g,''),
        consignee_mobile:      (od.consignee_phone  ||'').replace(/[^0-9+\-()\s]/g,''),
      },
      shipper: {
        shipper_name:        (shipper.name     ||'').slice(0,200),
        shipper_company:     (shipper.company  ||'').slice(0,200),
        shipper_countrycode: 'MX',
        shipper_province:    (shipper.province ||'').slice(0,100),
        shipper_city:        (shipper.city     ||'').slice(0,100),
        shipper_street:      (shipper.street   ||'').slice(0,300),
        shipper_postcode:    (shipper.postcode ||'').replace(/\D/g,''),
        shipper_telephone:   (shipper.telephone||'').replace(/[^0-9+\-()\s]/g,''),
        shipper_mobile:      (shipper.telephone||'').replace(/[^0-9+\-()\s]/g,''),
      },
      invoice: (od.items||[{name_en:'Goods',qty:1,price:1,weight:0.1}]).slice(0,20).map((i:any)=>({
        invoice_enname:     (i.name_en||'Goods').slice(0,200),
        invoice_cnname:     (i.name_cn||i.name_en||'Goods').slice(0,200),
        invoice_quantity:   Math.max(1,   parseInt(i.qty||'1')),
        invoice_unitcharge: Math.max(0.01,parseFloat(i.price||'1')),
        net_weight:         Math.max(0.001,parseFloat(i.weight||'0.1')),
        invoice_note:       (i.note||'').slice(0,100),
      })),
    }
    const jt = await jtCall('createorder', params)
    if (jt.success == 1) {
      const track = jt.data?.channel_hawbcode || jt.data?.shipping_method_no || ''
      const label = jt.data?.packages?.[0]?.child_label || ''
      await sb.from('jt_orders').update({ status:'synced', tracking_no:track, jt_order_id:String(jt.data?.order_id||''), label_url:label, sync_error:'' }).eq('reference_no', ref)
      return ok({ status:'synced', tracking_no:track, label_url:label, jt_result:jt })
    } else {
      const se = (jt.cnmessage||jt.enmessage||'未知错误').slice(0,200)
      await sb.from('jt_orders').update({ status:'sync_error', sync_error:se }).eq('reference_no', ref)
      return ok({ status:'sync_error', jt_result:jt })
    }
  }

  // ── Addresses ────────────────────────────────────────────
  if (action === 'get_addresses') {
    const cc = isAdmin ? (body.client_code||'') : customerCode
    const { data } = await sb.from('jt_addresses').select('*').eq('client_code',cc).order('created_at',{ascending:false}).limit(200)
    return ok(data||[])
  }
  if (action === 'save_address') {
    const cc    = isAdmin ? (body.client_code||'') : customerCode
    const alias = `${body.name||''} - CP ${(body.postcode||'').replace(/\D/g,'')}`
    const id    = /^addr_\w+$/.test(body.id||'') ? body.id : 'addr_'+Date.now()
    await sb.from('jt_addresses').upsert({ id, client_code:cc, alias,
      name:body.name||'', company:body.company||'', phone:body.phone||'',
      postcode:(body.postcode||'').replace(/\D/g,''), colonia:body.colonia||'',
      city:body.city||'', state:body.state||'', street:body.street||'',
      interior:body.interior||'', reference:body.reference||''
    },{ onConflict:'id' })
    return ok({ id, alias })
  }
  if (action === 'delete_address') {
    const cc = isAdmin ? (body.client_code||'') : customerCode
    await sb.from('jt_addresses').delete().eq('id',body.id).eq('client_code',cc)
    return ok()
  }

  // ── Config (admin only) ───────────────────────────────────
  if (!isAdmin && ['get_config','save_config','test_connection','get_jt_clients','save_jt_client','delete_jt_client'].includes(action)) {
    return err('无权限', 403)
  }
  if (action === 'get_config') {
    const [appToken, appKey, apiUrl, shippingMethod, shipperJson] = await Promise.all([
      cfgGet('app_token'), cfgGet('app_key'), cfgGet('api_url'), cfgGet('shipping_method'), cfgGet('shipper')
    ])
    return ok({ appToken, appKey: appKey?'••••••':'', apiUrl, shippingMethod, shipper: JSON.parse(shipperJson||'{}') })
  }
  if (action === 'save_config') {
    if (body.appToken !== undefined)                   await cfgSet('app_token',        body.appToken)
    if (body.appKey && body.appKey !== '••••••')       await cfgSet('app_key',          body.appKey)
    if (body.apiUrl)                                   await cfgSet('api_url',          body.apiUrl)
    if (body.shippingMethod)                           await cfgSet('shipping_method',  body.shippingMethod)
    if (body.shipper)                                  await cfgSet('shipper',          JSON.stringify(body.shipper))
    return ok()
  }
  if (action === 'test_connection') {
    if (body.appToken) await cfgSet('app_token', body.appToken)
    if (body.appKey && body.appKey !== '••••••') await cfgSet('app_key', body.appKey)
    return ok(await jtCall('getshippingmethod', {}))
  }

  return err('无效请求', 400)
}

export async function GET() { return NextResponse.json({ ok: true, service: 'JT Express API' }) }
