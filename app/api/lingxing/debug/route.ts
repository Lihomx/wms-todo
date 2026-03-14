export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/lingxing/debug
 * 探测每个接口的正确必填参数
 * 签名算法：appKey + sorted(业务参数values) + reqTime  (OLD/CORRECT)
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { decrypt } from '@/lib/crypto'
import { createHmac } from 'crypto'

const API_BASE    = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

// ✅ 正确签名：appKey固定最前，data参数key转小写字典序排序拼接values，reqTime固定最后
function sign(appKey: string, appSecret: string, reqTime: string, data: Record<string,any>): string {
  const v = Object.entries(data)
    .map(([k,v]) => [k.toLowerCase(), v] as [string,any])
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([,v]) => String(v)).join('')
  return createHmac('sha256', appSecret).update(appKey + v + reqTime).digest('hex')
}

async function call(appKey: string, appSecret: string, endpoint: string, data: Record<string,any>={}) {
  const reqTime  = String(Math.floor(Date.now()/1000))
  const authcode = sign(appKey, appSecret, reqTime, data)
  const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey, ...data, reqTime }),
    signal: AbortSignal.timeout(8000),
  })
  const text = await res.text()
  let json: any = {}
  try { json = JSON.parse(text) } catch { /**/ }
  const code = json.code ?? json.status
  const ok   = code===200||code===0||code==='200'||code==='0'
  return { ok, httpStatus: res.status, code, msg: json.message??json.msg??'', raw: text.slice(0,500), data: json.data }
}

async function tryVariants(appKey: string, appSecret: string, label: string, endpoint: string, variants: {desc:string;params:Record<string,any>}[]) {
  const results = []
  for (const v of variants) {
    try {
      const r = await call(appKey, appSecret, endpoint, v.params)
      results.push({ desc: v.desc, ok: r.ok, code: r.code, msg: r.msg,
        total: r.data?.total ?? r.data?.totalCount ?? (Array.isArray(r.data) ? r.data.length : null),
        sampleKeys: r.data ? (Array.isArray(r.data) ? Object.keys(r.data[0]??{}).slice(0,10) : (r.data.list ? Object.keys(r.data.list[0]??{}).slice(0,10) : Object.keys(r.data).slice(0,8))) : [],
        raw: r.raw })
      if (r.ok) break
    } catch(e:any) {
      results.push({ desc: v.desc, ok: false, code: 'ERR', msg: e.message, total: null, sampleKeys: [], raw: '' })
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return { label, endpoint, results }
}

export async function GET(_req: NextRequest) {
  const supabase = getSupabaseAdminClient()
  const { data: cred, error } = await supabase
    .from('lingxing_credentials')
    .select('app_key,app_secret,auth_status,warehouse_ids')
    .eq('tenant_id', DEFAULT_TENANT)
    .single()

  if (error || !cred) return NextResponse.json({ error: `DB: ${error?.message ?? '无凭证'}` })

  const appKey    = decrypt(cred.app_key)
  const appSecret = decrypt(cred.app_secret)
  const wh = 'LIHO' // known warehouse code

  const today  = new Date().toISOString().split('T')[0]
  const s30    = new Date(Date.now()-30*864e5).toISOString().split('T')[0]
  const s90    = new Date(Date.now()-90*864e5).toISOString().split('T')[0]
  const s365   = new Date(Date.now()-365*864e5).toISOString().split('T')[0]
  const t = (d:string) => `${d} 00:00:00`
  const te = `${today} 23:59:59`

  const probes = await Promise.all([
    // 仓库（已知OK）
    tryVariants(appKey, appSecret, '仓库列表', '/v1/warehouse/options', [
      { desc: '{}', params: {} },
    ]),

    // 入库单 — 试各种必填组合
    tryVariants(appKey, appSecret, '入库单', '/v1/inboundOrder/pageList', [
      { desc: 'page,pageSize',                              params: { page:1, pageSize:10 } },
      { desc: '+warehouseCode',                             params: { page:1, pageSize:10, warehouseCode:wh } },
      { desc: '+startTime(30天)',                           params: { page:1, pageSize:10, startTime:t(s30), endTime:te } },
      { desc: '+startTime(90天)',                           params: { page:1, pageSize:10, startTime:t(s90), endTime:te } },
      { desc: '+startTime(365天)',                          params: { page:1, pageSize:10, startTime:t(s365), endTime:te } },
      { desc: 'wh+startTime(30天)',                         params: { page:1, pageSize:10, warehouseCode:wh, startTime:t(s30), endTime:te } },
      { desc: 'wh+startTime(90天)',                         params: { page:1, pageSize:10, warehouseCode:wh, startTime:t(s90), endTime:te } },
      { desc: 'pageNo instead of page',                    params: { pageNo:1, pageSize:10 } },
      { desc: 'pageNo+wh',                                  params: { pageNo:1, pageSize:10, warehouseCode:wh } },
      { desc: 'pageNo+startTime',                           params: { pageNo:1, pageSize:10, startTime:t(s90), endTime:te } },
      { desc: 'pageIndex',                                  params: { pageIndex:1, pageSize:10 } },
      { desc: 'pageIndex+wh',                               params: { pageIndex:1, pageSize:10, warehouseCode:wh } },
    ]),

    // 小包出库
    tryVariants(appKey, appSecret, '小包出库', '/v1/outboundOrder/pageList', [
      { desc: 'page,pageSize',                              params: { page:1, pageSize:10 } },
      { desc: '+warehouseCode',                             params: { page:1, pageSize:10, warehouseCode:wh } },
      { desc: '+startTime(30天)',                           params: { page:1, pageSize:10, startTime:t(s30), endTime:te } },
      { desc: '+startTime(90天)',                           params: { page:1, pageSize:10, startTime:t(s90), endTime:te } },
      { desc: 'wh+startTime(30天)',                         params: { page:1, pageSize:10, warehouseCode:wh, startTime:t(s30), endTime:te } },
      { desc: 'wh+startTime(90天)',                         params: { page:1, pageSize:10, warehouseCode:wh, startTime:t(s90), endTime:te } },
      { desc: 'pageNo,pageSize',                            params: { pageNo:1, pageSize:10 } },
      { desc: 'pageNo+wh',                                  params: { pageNo:1, pageSize:10, warehouseCode:wh } },
      { desc: 'pageNo+startTime',                           params: { pageNo:1, pageSize:10, startTime:t(s90), endTime:te } },
      { desc: 'pageIndex',                                  params: { pageIndex:1, pageSize:10 } },
    ]),

    // 退件单
    tryVariants(appKey, appSecret, '退件单', '/v1/returnOrder/pageList', [
      { desc: 'page,pageSize',                              params: { page:1, pageSize:10 } },
      { desc: '+warehouseCode',                             params: { page:1, pageSize:10, warehouseCode:wh } },
      { desc: '+startTime(30天)',                           params: { page:1, pageSize:10, startTime:t(s30), endTime:te } },
      { desc: '+startTime(90天)',                           params: { page:1, pageSize:10, startTime:t(s90), endTime:te } },
      { desc: 'wh+startTime(30天)',                         params: { page:1, pageSize:10, warehouseCode:wh, startTime:t(s30), endTime:te } },
      { desc: 'wh+startTime(90天)',                         params: { page:1, pageSize:10, warehouseCode:wh, startTime:t(s90), endTime:te } },
      { desc: 'pageNo,pageSize',                            params: { pageNo:1, pageSize:10 } },
      { desc: 'pageNo+wh',                                  params: { pageNo:1, pageSize:10, warehouseCode:wh } },
      { desc: 'pageNo+startTime',                           params: { pageNo:1, pageSize:10, startTime:t(s90), endTime:te } },
    ]),

    // 综合库存
    tryVariants(appKey, appSecret, '综合库存', '/v1/integratedInventory/pageOpen', [
      { desc: 'page,pageSize',                              params: { page:1, pageSize:10 } },
      { desc: '+wh',                                        params: { page:1, pageSize:10, warehouseCode:wh } },
      { desc: '+type=1',                                    params: { page:1, pageSize:10, inventoryType:1 } },
      { desc: '+type=1+wh',                                 params: { page:1, pageSize:10, inventoryType:1, warehouseCode:wh } },
      { desc: '+type=1+startTime(30天)',                    params: { page:1, pageSize:10, inventoryType:1, startTime:t(s30), endTime:te } },
      { desc: '+type=1+startTime(90天)',                    params: { page:1, pageSize:10, inventoryType:1, startTime:t(s90), endTime:te } },
      { desc: '+type=1+wh+startTime(30天)',                 params: { page:1, pageSize:10, inventoryType:1, warehouseCode:wh, startTime:t(s30), endTime:te } },
      { desc: '+type=1+wh+startTime(90天)',                 params: { page:1, pageSize:10, inventoryType:1, warehouseCode:wh, startTime:t(s90), endTime:te } },
      { desc: 'pageNo+type=1',                              params: { pageNo:1, pageSize:10, inventoryType:1 } },
      { desc: 'pageNo+type=1+wh',                           params: { pageNo:1, pageSize:10, inventoryType:1, warehouseCode:wh } },
      { desc: 'pageNo+type=1+startTime(30天)',               params: { pageNo:1, pageSize:10, inventoryType:1, startTime:t(s30), endTime:te } },
      { desc: 'pageNo+type=1+wh+startTime(30天)',            params: { pageNo:1, pageSize:10, inventoryType:1, warehouseCode:wh, startTime:t(s30), endTime:te } },
    ]),
  ])

  const summary = probes.map(p => ({
    label: p.label,
    success: p.results.some(r=>r.ok),
    winner: p.results.find(r=>r.ok) ?? null,
    allResults: p.results.map(r=>({desc:r.desc, ok:r.ok, code:r.code, msg:r.msg})),
  }))

  return NextResponse.json({ summary, timestamp: new Date().toISOString() })
}
