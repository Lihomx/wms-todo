/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

function makeAuthcode(appKey: string, appSecret: string, reqTime: string, data: Record<string, any>): string {
  const valuesStr = Object.entries(data)
    .map(([k, v]) => [k.toLowerCase(), v] as [string, any])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => String(v)).join('')
  return createHmac('sha256', appSecret).update(appKey + valuesStr + reqTime).digest('hex')
}

async function callOMS(body: Record<string, any>, endpoint: string): Promise<{status: number; code: any; msg: string; raw: string}> {
  const res  = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const raw  = await res.text()
  let json: any = {}
  try { json = JSON.parse(raw) } catch { /* */ }
  return { status: res.status, code: json.code ?? json.status, msg: json.message ?? json.msg ?? '-', raw: raw.slice(0, 300) }
}

export async function POST(req: NextRequest) {
  const steps: { step: string; status: 'ok' | 'fail' | 'info'; detail: string }[] = []

  const { appKey, appSecret } = await req.json()
  const data    = { page: 1, pageSize: 10 }
  const reqTime = String(Math.floor(Date.now() / 1000))
  const code    = makeAuthcode(appKey, appSecret, reqTime, data)

  steps.push({ step: '签名', status: 'info',
    detail: `reqTime=${reqTime}\nauthcode=${code}` })

  // 试验1: authcode 小写（当前方案）
  const r1 = await callOMS({ appKey, ...data, reqTime, authcode: code }, '/v1/warehouse/options')
  steps.push({ step: '试验1: authcode（小写c）', status: (r1.code==200||r1.code==0||r1.code=='200'||r1.code=='0') ? 'ok':'fail',
    detail: `code=${r1.code} msg=${r1.msg}\n${r1.raw}` })

  // 试验2: authCode 大写C
  const r2 = await callOMS({ appKey, ...data, reqTime, authCode: code }, '/v1/warehouse/options')
  steps.push({ step: '试验2: authCode（大写C）', status: (r2.code==200||r2.code==0||r2.code=='200'||r2.code=='0') ? 'ok':'fail',
    detail: `code=${r2.code} msg=${r2.msg}\n${r2.raw}` })

  // 试验3: sign 字段名
  const r3 = await callOMS({ appKey, ...data, reqTime, sign: code }, '/v1/warehouse/options')
  steps.push({ step: '试验3: sign', status: (r3.code==200||r3.code==0||r3.code=='200'||r3.code=='0') ? 'ok':'fail',
    detail: `code=${r3.code} msg=${r3.msg}\n${r3.raw}` })

  // 试验4: data嵌套 + authcode
  const r4 = await callOMS({ appKey, data, reqTime, authcode: code }, '/v1/warehouse/options')
  steps.push({ step: '试验4: data嵌套+authcode', status: (r4.code==200||r4.code==0||r4.code=='200'||r4.code=='0') ? 'ok':'fail',
    detail: `code=${r4.code} msg=${r4.msg}\n${r4.raw}` })

  // 试验5: data嵌套 + authCode大写
  const r5 = await callOMS({ appKey, data, reqTime, authCode: code }, '/v1/warehouse/options')
  steps.push({ step: '试验5: data嵌套+authCode大写', status: (r5.code==200||r5.code==0||r5.code=='200'||r5.code=='0') ? 'ok':'fail',
    detail: `code=${r5.code} msg=${r5.msg}\n${r5.raw}` })

  // 试验6: 完全展开（包括data里的字段）+ authCode在data内
  const r6 = await callOMS({ appKey, ...data, reqTime, data: { authcode: code } }, '/v1/warehouse/options')
  steps.push({ step: '试验6: 展开+authcode在data内', status: (r6.code==200||r6.code==0||r6.code=='200'||r6.code=='0') ? 'ok':'fail',
    detail: `code=${r6.code} msg=${r6.msg}\n${r6.raw}` })

  return NextResponse.json({ steps })
}
