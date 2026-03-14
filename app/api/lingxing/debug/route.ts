/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * GET /api/lingxing/debug
 * 暴力探测每个接口的正确参数组合，找出 HTTP500 的真实原因
 */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { decrypt } from '@/lib/crypto'
import { createHmac } from 'crypto'

const API_BASE    = 'https://api.xlwms.com/openapi'
const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

// ─── 正确签名：全部参数（含appKey、reqTime）合并后统一小写字典序排序 ────────
function sign(appKey: string, appSecret: string, reqTime: string, data: Record<string,any>): string {
  const all = { appKey, ...data, reqTime }
  const v   = Object.entries(all)
    .map(([k,v]) => [k.toLowerCase(), v] as [string,any])
    .sort(([a],[b]) => a.localeCompare(b))
    .map(([,v]) => String(v)).join('')
  return createHmac('sha256', appSecret).update(v).digest('hex')
}

async function call(appKey: string, appSecret: string, endpoint: string, data: Record<string,any>={}) {
  const reqTime  = String(Math.floor(Date.now()/1000))
  const authcode = sign(appKey, appSecret, reqTime, data)
  const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ appKey, ...data, reqTime }),
    signal: AbortSignal.timeout(8000),
  })
  const text = await res.text()
  let json: any = {}
  try { json = JSON.parse(text) } catch { /**/ }
  const code = json.code ?? json.status
  const ok   = code===200 || code===0 || code==='200' || code==='0'
  return { ok, httpStatus: res.status, code, msg: json.message ?? json.msg ?? '', raw: text.slice(0,500), data: json.data }
}

// 对同一个接口试多种参数，返回第一个成功的 or 所有结果
async function tryVariants(
  appKey: string, appSecret: string,
  label: string, endpoint: string,
  variants: Array<{ desc: string; params: Record<string,any> }>
) {
  const results = []
  for (const v of variants) {
    try {
      const r = await call(appKey, appSecret, endpoint, v.params)
      results.push({ desc: v.desc, ...r })
      if (r.ok) break // 找到能用的就停
    } catch(e:any) {
      results.push({ desc: v.desc, ok: false, httpStatus: 0, code: 'ERR', msg: e.message, raw: '', data: null })
    }
    await new Promise(r => setTimeout(r, 200))
  }
  return { label, endpoint, results }
}

export async function GET(_req: NextRequest) {
  // ─── 读取凭证 ─────────────────────────────────────────────
  const supabase = getSupabaseAdminClient()
  const { data: cred, error } = await supabase
    .from('lingxing_credentials')
    .select('app_key,app_secret,auth_status,warehouse_ids')
    .eq('tenant_id', DEFAULT_TENANT)
    .single()

  if (error || !cred) return NextResponse.json({ error: `DB error: ${error?.message ?? '无凭证'}` })

  const appKey    = decrypt(cred.app_key)
  const appSecret = decrypt(cred.app_secret)
  const warehouseCodes = (cred.warehouse_ids ?? []).filter((w:string) => w && w !== 'undefined')
  const wh = warehouseCodes[0] ?? 'LIHO'  // fallback to known code

  const today = new Date().toISOString().split('T')[0]
  const start30  = new Date(Date.now()-30*864e5).toISOString().split('T')[0]
  const start90  = new Date(Date.now()-90*864e5).toISOString().split('T')[0]
  const start365 = new Date(Date.now()-365*864e5).toISOString().split('T')[0]

  // ─── 并行探测所有接口 ─────────────────────────────────────
  const probes = await Promise.all([

    // 仓库（已知可用）
    tryVariants(appKey, appSecret, '仓库列表', '/v1/warehouse/options', [
      { desc: '无参', params: {} },
    ]),

    // 入库单 - 试多种参数
    tryVariants(appKey, appSecret, '入库单', '/v1/inboundOrder/pageList', [
      { desc: 'page+pageSize',                       params: { page:1, pageSize:10 } },
      { desc: '+warehouseCode=LIHO',                 params: { page:1, pageSize:10, warehouseCode: wh } },
      { desc: '+startTime 30天',                     params: { page:1, pageSize:10, startTime:`${start30} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: '+startTime 90天',                     params: { page:1, pageSize:10, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: '+startTime 365天',                    params: { page:1, pageSize:10, startTime:`${start365} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'startTime+wh',                        params: { page:1, pageSize:10, warehouseCode: wh, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'createStartTime',                     params: { page:1, pageSize:10, createStartTime:`${start90} 00:00:00`, createEndTime:`${today} 23:59:59` } },
      { desc: 'createStartTime+wh',                  params: { page:1, pageSize:10, warehouseCode: wh, createStartTime:`${start90} 00:00:00`, createEndTime:`${today} 23:59:59` } },
    ]),

    // 小包出库
    tryVariants(appKey, appSecret, '小包出库单', '/v1/outboundOrder/pageList', [
      { desc: 'page+pageSize',                       params: { page:1, pageSize:10 } },
      { desc: '+warehouseCode',                      params: { page:1, pageSize:10, warehouseCode: wh } },
      { desc: '+startTime 30天',                     params: { page:1, pageSize:10, startTime:`${start30} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: '+startTime 90天',                     params: { page:1, pageSize:10, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'startTime+wh',                        params: { page:1, pageSize:10, warehouseCode: wh, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'createStartTime+wh',                  params: { page:1, pageSize:10, warehouseCode: wh, createStartTime:`${start90} 00:00:00`, createEndTime:`${today} 23:59:59` } },
    ]),

    // 大货出库（11008=无接口权限，跳过深度测试）
    tryVariants(appKey, appSecret, '大货出库单', '/v1/bigOutboundOrder/pageList', [
      { desc: 'page+pageSize', params: { page:1, pageSize:10 } },
      { desc: '+wh',           params: { page:1, pageSize:10, warehouseCode: wh } },
    ]),

    // 退件单
    tryVariants(appKey, appSecret, '退件单', '/v1/returnOrder/pageList', [
      { desc: 'page+pageSize',                       params: { page:1, pageSize:10 } },
      { desc: '+warehouseCode',                      params: { page:1, pageSize:10, warehouseCode: wh } },
      { desc: '+startTime 30天',                     params: { page:1, pageSize:10, startTime:`${start30} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: '+startTime 90天',                     params: { page:1, pageSize:10, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'startTime+wh',                        params: { page:1, pageSize:10, warehouseCode: wh, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'createStartTime',                     params: { page:1, pageSize:10, createStartTime:`${start90} 00:00:00`, createEndTime:`${today} 23:59:59` } },
    ]),

    // 库存 - 试不同参数
    tryVariants(appKey, appSecret, '综合库存', '/v1/integratedInventory/pageOpen', [
      { desc: 'page+pageSize 无其他参数',             params: { page:1, pageSize:10 } },
      { desc: '+warehouseCode',                      params: { page:1, pageSize:10, warehouseCode: wh } },
      { desc: 'inventoryType=1 无时间',              params: { page:1, pageSize:10, inventoryType:1 } },
      { desc: 'inventoryType=1 +wh',                params: { page:1, pageSize:10, inventoryType:1, warehouseCode: wh } },
      { desc: 'type=1 +startTime(30天)',             params: { page:1, pageSize:10, inventoryType:1, startTime:`${start30} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'type=1 +startTime(90天)',             params: { page:1, pageSize:10, inventoryType:1, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'type=1 +wh+startTime(30天)',          params: { page:1, pageSize:10, inventoryType:1, warehouseCode: wh, startTime:`${start30} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'type=1 +wh+startTime(90天)',          params: { page:1, pageSize:10, inventoryType:1, warehouseCode: wh, startTime:`${start90} 00:00:00`, endTime:`${today} 23:59:59` } },
      { desc: 'type=2 无时间',                       params: { page:1, pageSize:10, inventoryType:2 } },
      { desc: 'type=2 +wh',                         params: { page:1, pageSize:10, inventoryType:2, warehouseCode: wh } },
    ]),

    // 产品列表
    tryVariants(appKey, appSecret, '产品列表', '/v1/product/pageList', [
      { desc: 'page+pageSize', params: { page:1, pageSize:10 } },
      { desc: '+wh',           params: { page:1, pageSize:10, warehouseCode: wh } },
    ]),
  ])

  // 汇总：哪些成功、哪些失败
  const summary = probes.map(p => {
    const winner = p.results.find(r => r.ok)
    return {
      label:    p.label,
      endpoint: p.endpoint,
      success:  !!winner,
      winningParams: winner?.desc ?? null,
      winningTotal: winner?.data?.total ?? winner?.data?.totalCount ?? (Array.isArray(winner?.data) ? winner?.data?.length : null),
      allResults: p.results.map(r => ({ desc: r.desc, ok: r.ok, code: r.code, msg: r.msg })),
      rawWinner: winner?.raw?.slice(0,300) ?? p.results[p.results.length-1]?.raw?.slice(0,300),
    }
  })

  return NextResponse.json({
    meta: { wh, warehouseCodes, tenant: DEFAULT_TENANT },
    summary,
    timestamp: new Date().toISOString(),
  })
}
