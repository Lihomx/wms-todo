export const dynamic = 'force-dynamic'
/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { generateAuthcodeV2 } from '@/lib/lingxing'

const API_BASE = 'https://api.xlwms.com/openapi'

function makeAuthcode(appKey: string, appSecret: string, reqTime: string, data: Record<string,any>): string {
  return generateAuthcodeV2(appKey, appSecret, reqTime, data)
}

export async function POST(req: NextRequest) {
  const steps: {step:string;status:'ok'|'fail'|'info';detail:string}[] = []
  const { appKey, appSecret } = await req.json()

  // ── Step 1: 查询本机出口IP ────────────────────────────────
  try {
    const ipRes  = await fetch('https://api.ipify.org?format=json')
    const ipJson = await ipRes.json()
    steps.push({ step: 'Vercel出口IP', status: 'info', detail: ipJson.ip })
  } catch(e:any) {
    steps.push({ step: 'Vercel出口IP', status: 'fail', detail: e.message })
  }

  // ── Step 2: 正常签名请求 ──────────────────────────────────
  const reqTime  = String(Math.floor(Date.now() / 1000))
  const data     = { page: 1, pagesize: 10 }
  const authcode = makeAuthcode(appKey, appSecret, reqTime, data)
  const body     = { appKey, ...data, reqTime }
  const url      = `${API_BASE}/v1/warehouse/options?authcode=${authcode}`

  steps.push({ step: '请求URL（authcode在params）', status: 'info', detail: url })

  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    const raw = await res.text()
    const json = JSON.parse(raw)
    const code = json.code ?? json.status
    const ok = code===200||code===0||code==='200'||code==='0'
    steps.push({ step: 'OMS仓库接口', status: ok?'ok':'fail',
      detail: `code=${code} msg=${json.message}\n${raw}` })
  } catch(e:any) {
    steps.push({ step: 'OMS仓库接口', status: 'fail', detail: e.message })
  }

  // ── Step 3: 用不同Content-Type试试 ───────────────────────
  try {
    const res = await fetch(`${API_BASE}/v1/warehouse/options`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'User-Agent': 'Mozilla/5.0',
      },
      body: JSON.stringify(body),
    })
    const raw = await res.text()
    steps.push({ step: '加User-Agent重试', status: 'info', detail: raw })
  } catch(e:any) {
    steps.push({ step: '加User-Agent重试', status: 'fail', detail: e.message })
  }

  // ── Step 4: 检查是否能正常访问xlwms.com ──────────────────
  try {
    const res = await fetch('https://oms.xlwms.com', { method: 'GET' })
    steps.push({ step: '访问oms.xlwms.com', status: 'ok',
      detail: `HTTP ${res.status}` })
  } catch(e:any) {
    steps.push({ step: '访问oms.xlwms.com', status: 'fail', detail: e.message })
  }

  return NextResponse.json({ steps })
}
