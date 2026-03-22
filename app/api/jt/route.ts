/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { createHmac, randomBytes, timingSafeEqual, createHash } from 'crypto'

const JWT_SECRET = process.env.JT_JWT_SECRET || 'jitu_secret_change_in_prod_2024'
const JT_API_BASE = 'http://jthq.rtb56.com/webservice/PublicService.asmx/ServiceInterfaceUTF8'

// ─── helpers ─────────────────────────────────────────────
function ok(data: any = {}) { return NextResponse.json({ success: 1, data }) }
function err(msg: string, status = 400) { return NextResponse.json({ success: 0, msg }, { status }) }

async function signToken(payload: object): Promise<string> {
  const header = Buffer.from(JSON.stringify({ alg:'HS256', typ:'JWT' })).toString('base64url')
  const body   = Buffer.from(JSON.stringify({ ...payload as any, exp: Math.floor(Date.now()/1000) + 8*3600 })).toString('base64url')
  const sig    = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
  return `${header}.${body}.${sig}`
}
async function verifyToken(token: string): Promise<any> {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [header, body, sig] = parts
    const expected = createHmac('sha256', JWT_SECRET).update(`${header}.${body}`).digest('base64url')
    try { if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null } catch { return null }
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString())
    if (payload.exp && payload.exp < Math.floor(Date.now()/1000)) return null
    return payload
  } catch { return null }
}

async function cfgGet(k: string) {
  const sb = getSupabaseAdminClient()
  const { data } = await sb.from('jt_config').select('v').eq('k', k).single()
  return data?.v ?? ''
}
async function cfgSet(k: string, v: string) {
  await getSupabaseAdminClient().from('jt_config').upsert({ k, v }, { onConflict: 'k' })
}

async function jtCall(method: string, params: object) {
  const [token, key] = await Promise.all([cfgGet('app_token'), cfgGet('app_key')])
  if (!token || !key) return { success: 0, cnmessage: 'API Token/Key未配置' }
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
    return { success: 0, cnmessage: '无法连接到J&T服务器: ' + e.message }
  }
}

function getToken(req: NextRequest) {
  return req.headers.get('x-session-token') || ''
}

// ─── main handler ─────────────────────────────────────────
export async function POST(req: NextRequest) {
  const action = new URL(req.url).searchParams.get('action') || ''
  const body   = await req.json().catch(() => ({}))
  const sb     = getSupabaseAdminClient()

  // ── Auth ──────────────────────────────────────────────
  if (action === 'client_login') {
    const { username, password } = body
    const { data: client } = await sb.from('jt_clients')
      .select('*').eq('username', username).single()
    if (!client) return err('Usuario o contraseña incorrectos')
    const ok2 = (() => {
      const h = client.password_hash
      if (!h || !h.includes(".")) return password === h
      const [stored_hash, salt] = h.split(".")
      const attempt = createHmac("sha256", salt).update(password||"").digest("hex")
      try { return timingSafeEqual(Buffer.from(stored_hash), Buffer.from(attempt)) } catch { return false }
    })()
    if (!ok2) return err('Usuario o contraseña incorrectos')
    const token = await signToken({ role:'client', username, clientCode: client.client_code, clientId: client.id })
    return ok({ ...client, password_hash: undefined, token, role:'client' })
  }

  if (action === 'admin_login') {
    const [storedUser, storedHash] = await Promise.all([cfgGet('admin_username'), cfgGet('admin_password')])
    if (!storedHash) return err('管理员密码未设置')
    const isOk = (() => {
      if (!storedHash.includes(".")) return body.password === storedHash // plain fallback
      const [stored_hash, salt] = storedHash.split(".")
      const attempt = createHmac("sha256", salt).update(body.password||"").digest("hex")
      try { return timingSafeEqual(Buffer.from(stored_hash), Buffer.from(attempt)) } catch { return false }
    })()
    if (body.username !== storedUser || !isOk) return err('Usuario o contraseña incorrectos')
    const token = await signToken({ role: 'admin', username: body.username })
    return ok({ role: 'admin', username: body.username, token })
  }

  // ── Token auth required below ──────────────────────────
  const payload = await verifyToken(getToken(req))
  if (!payload) return err('未登录或会话已过期', 401)
  const isAdmin = payload.role === 'admin'

  // ── Orders ────────────────────────────────────────────
  if (action === 'create_order') {
    const o = body.order || {}
    const ref = (o.reference_no || '').trim().replace(/[^A-Za-z0-9\-_]/g, '').slice(0, 50)
    if (!ref) return err('reference_no必填')
    const id = 'ord_' + Date.now()
    const allowedKeys = ['reference_no','client_code','client_name','consignee_name','consignee_company',
      'consignee_phone','consignee_postcode','consignee_colonia','shipping_city','shipping_state',
      'consignee_street','consignee_interior','consignee_reference','weight','pieces',
      'largo','ancho','alto','cargo_type','cargo_content','notes','pkg_notes','items']
    const safe: any = {}
    for (const k of allowedKeys) if (o[k] !== undefined) safe[k] = o[k]
    const { error } = await sb.from('jt_orders').upsert({
      id, reference_no: ref, data: safe, status: 'reviewing',
      client_code: o.client_code || payload.clientCode || '',
      client_name: o.client_name || '',
    }, { onConflict: 'reference_no' })
    if (error) return err('创建失败: ' + error.message)
    // Auto-save address
    if (o.consignee_name && o.consignee_postcode) {
      const alias = `${o.consignee_name} - CP ${(o.consignee_postcode||'').replace(/\D/g,'')}`
      const cc = o.client_code || payload.clientCode || ''
      const { data: ex } = await sb.from('jt_addresses').select('id').eq('client_code',cc).eq('alias',alias).single()
      if (!ex) {
        await sb.from('jt_addresses').insert({
          id: 'addr_'+Date.now(), client_code: cc, alias,
          name: o.consignee_name, company: o.consignee_company||'',
          phone: o.consignee_phone, postcode: (o.consignee_postcode||'').replace(/\D/g,''),
          colonia: o.consignee_colonia, city: o.shipping_city, state: o.shipping_state,
          street: o.consignee_street, interior: o.consignee_interior||'',
          reference: o.consignee_reference||'',
        })
      }
    }
    return ok({ order_id: id, reference_no: ref, status: 'reviewing' })
  }

  if (action === 'get_orders') {
    let query = sb.from('jt_orders').select('*').order('created_at', { ascending: false })
    if (!isAdmin) query = query.eq('client_code', payload.clientCode || '')
    else query = query.limit(1000)
    const { data } = await query.limit(500)
    return ok(data || [])
  }

  if (action === 'delete_order') {
    const ref = body.reference_no
    const jt  = await jtCall('removeorder', { reference_no: ref })
    await sb.from('jt_orders').update({ status: 'deleted', sync_error: `J&T: ${jt.success==1?'成功':(jt.cnmessage||'?')}` }).eq('reference_no', ref)
    return ok({ jt })
  }

  if (action === 'update_order') {
    const { reference_no: ref, status, tracking_no, weight } = body
    if (!isAdmin) return err('无权限', 403)
    if (weight > 0) await jtCall('updateorder', { reference_no: ref, order_weight: weight })
    await sb.from('jt_orders').update({ status, tracking_no: tracking_no||'' }).eq('reference_no', ref)
    return ok()
  }

  if (action === 'get_tracking') {
    const ref = body.reference_no
    const jt  = await jtCall('gettrackingnumber', { reference_no: ref })
    if (jt.success == 1) {
      const track = jt.data?.channel_hawbcode || jt.data?.shipping_method_no || ''
      await sb.from('jt_orders').update({ tracking_no: track, status: 'synced' }).eq('reference_no', ref)
    }
    return ok(jt)
  }

  if (action === 'submit_to_jt') {
    if (!isAdmin) return err('无权限', 403)
    const ref = body.reference_no
    const { data: row } = await sb.from('jt_orders').select('*').eq('reference_no', ref).single()
    if (!row) return err('订单不存在')
    if (row.status === 'synced')  return err('该订单已同步')
    if (row.status === 'deleted') return err('该订单已删除')
    const od: any = { ...row.data }
    // Apply any edits from admin
    if (body.order_data) Object.assign(od, body.order_data)

    const shipperJson = await cfgGet('shipper')
    const shipper = JSON.parse(shipperJson || '{}')
    const params = {
      reference_no:    ref,
      shipping_method: await cfgGet('shipping_method') || 'JT-MX-CD-N',
      order_weight:    Math.max(0.01, parseFloat(od.weight || '0.2')),
      order_pieces:    Math.max(1,    parseInt(od.pieces  || '1')),
      mail_cargo_type: ['1','2','3','4'].includes(od.cargo_type) ? od.cargo_type : '4',
      order_info:      (od.notes || '').slice(0, 200),
      consignee: {
        consignee_name:        (od.consignee_name   || '').slice(0, 200),
        consignee_company:     (od.consignee_company|| '').slice(0, 200),
        consignee_countrycode: 'MX',
        consignee_province:    (od.shipping_state   || '').slice(0, 100),
        consignee_city:        (od.shipping_city    || '').slice(0, 100),
        consignee_district:    (od.consignee_colonia|| '').slice(0, 200),
        consignee_street:      (od.consignee_street || '').slice(0, 300),
        consignee_postcode:    (od.consignee_postcode||'').replace(/\D/g,''),
        consignee_telephone:   (od.consignee_phone  || '').replace(/[^0-9+\-()\s]/g,''),
        consignee_mobile:      (od.consignee_phone  || '').replace(/[^0-9+\-()\s]/g,''),
      },
      shipper: {
        shipper_name:        (shipper.name      || '').slice(0,200),
        shipper_company:     (shipper.company   || '').slice(0,200),
        shipper_countrycode: 'MX',
        shipper_province:    (shipper.province  || '').slice(0,100),
        shipper_city:        (shipper.city      || '').slice(0,100),
        shipper_street:      (shipper.street    || '').slice(0,300),
        shipper_postcode:    (shipper.postcode  || '').replace(/\D/g,''),
        shipper_telephone:   (shipper.telephone || '').replace(/[^0-9+\-()\s]/g,''),
        shipper_mobile:      (shipper.telephone || '').replace(/[^0-9+\-()\s]/g,''),
      },
      invoice: (od.items || [{ name_en:'Goods', qty:1, price:1, weight:0.1 }])
        .slice(0, 20).map((i: any) => ({
          invoice_enname:   (i.name_en || 'Goods').slice(0,200),
          invoice_cnname:   (i.name_cn || i.name_en || 'Goods').slice(0,200),
          invoice_quantity: Math.max(1, parseInt(i.qty||'1')),
          invoice_unitcharge: Math.max(0.01, parseFloat(i.price||'1')),
          net_weight:       Math.max(0.001, parseFloat(i.weight||'0.1')),
          invoice_note:     (i.note||'').slice(0,100),
        })),
    }
    const jt = await jtCall('createorder', params)
    if (jt.success == 1) {
      const track  = jt.data?.channel_hawbcode || jt.data?.shipping_method_no || ''
      const jt_id  = String(jt.data?.order_id || '')
      const label  = jt.data?.packages?.[0]?.child_label || ''
      await sb.from('jt_orders').update({ status:'synced', tracking_no:track, jt_order_id:jt_id, label_url:label, sync_error:'' }).eq('reference_no', ref)
      return ok({ status:'synced', tracking_no:track, label_url:label, jt_result:jt })
    } else {
      const se = (jt.cnmessage || jt.enmessage || '未知错误').slice(0,200)
      await sb.from('jt_orders').update({ status:'sync_error', sync_error:se }).eq('reference_no', ref)
      return ok({ status:'sync_error', jt_result:jt })
    }
  }

  // ── Addresses ─────────────────────────────────────────
  if (action === 'get_addresses') {
    const cc = isAdmin ? (body.client_code||'') : (payload.clientCode||'')
    const { data } = await sb.from('jt_addresses').select('*').eq('client_code', cc).order('created_at', {ascending:false}).limit(200)
    return ok(data || [])
  }
  if (action === 'save_address') {
    const cc   = isAdmin ? (body.client_code||'') : (payload.clientCode||'')
    const alias = `${body.name||''} - CP ${(body.postcode||'').replace(/\D/g,'')}`
    const id   = /^addr_[a-z0-9.]+$/.test(body.id||'') ? body.id : 'addr_'+Date.now()
    await sb.from('jt_addresses').upsert({ id, client_code:cc, alias,
      name:body.name||'', company:body.company||'', phone:body.phone||'',
      postcode:(body.postcode||'').replace(/\D/g,''), colonia:body.colonia||'',
      city:body.city||'', state:body.state||'', street:body.street||'',
      interior:body.interior||'', reference:body.reference||''
    }, { onConflict: 'id' })
    return ok({ id, alias })
  }
  if (action === 'delete_address') {
    const cc = isAdmin ? (body.client_code||'') : (payload.clientCode||'')
    await sb.from('jt_addresses').delete().eq('id', body.id).eq('client_code', cc)
    return ok()
  }

  // ── Config (admin only) ──────────────────────────────
  if (!isAdmin && ['get_config','save_config','test_connection','get_clients','save_client','delete_client'].includes(action)) {
    return err('无权限', 403)
  }
  if (action === 'get_config') {
    const [appToken, appKey, apiUrl, shippingMethod, shipperJson] = await Promise.all([
      cfgGet('app_token'), cfgGet('app_key'), cfgGet('api_url'), cfgGet('shipping_method'), cfgGet('shipper')
    ])
    return ok({ appToken, appKey: appKey?'••••••':'', apiUrl, shippingMethod, shipper: JSON.parse(shipperJson||'{}') })
  }
  if (action === 'save_config') {
    if (body.appToken !== undefined)    await cfgSet('app_token', body.appToken)
    if (body.appKey && body.appKey !== '••••••') await cfgSet('app_key', body.appKey)
    if (body.apiUrl)                    await cfgSet('api_url', body.apiUrl)
    if (body.shippingMethod)            await cfgSet('shipping_method', body.shippingMethod)
    if (body.shipper)                   await cfgSet('shipper', JSON.stringify(body.shipper))
    return ok()
  }
  if (action === 'test_connection') {
    if (body.appToken) await cfgSet('app_token', body.appToken)
    if (body.appKey && body.appKey !== '••••••') await cfgSet('app_key', body.appKey)
    return ok(await jtCall('getshippingmethod', {}))
  }
  if (action === 'get_clients') {
    const { data } = await sb.from('jt_clients').select('id,username,name,company,email,phone,client_code')
    return ok(data || [])
  }
  if (action === 'save_client') {
    const { id, username, password, name, company, email, phone, clientCode } = body
    if ((password||'').length < 6) return err('密码至少6位')
    const salt = randomBytes(16).toString("hex"); const hash = createHmac("sha256", salt).update(password).digest("hex") + "." + salt
    const cid  = id || 'C' + Date.now()
    await sb.from('jt_clients').upsert({
      id: cid, username, password_hash: hash,
      name, company, email, phone, client_code: clientCode
    }, { onConflict: 'id' })
    return ok()
  }
  if (action === 'delete_client') {
    await sb.from('jt_clients').delete().eq('id', body.id)
    return ok()
  }

  return err('无效请求', 400)
}

export async function GET() { return NextResponse.json({ ok: true, service: 'JT API' }) }
