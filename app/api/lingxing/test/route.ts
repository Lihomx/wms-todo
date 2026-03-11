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

async function callOMS(body: Record<string, any>, endpoint: string): Promise<{ok: boolean; code: any; msg: string; raw: string}> {
  const res  = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  const raw  = await res.text()
  let json: any = {}
  try { json = JSON.parse(raw) } catch { /* */ }
  const code = json.code ?? json.status
  return { ok: code==200||code==0||code=='200'||code=='0', code, msg: json.message ?? json.msg ?? '-', raw: raw.slice(0,300) }
}

export async function POST(req: NextRequest) {
  const steps: { step: string; status: 'ok'|'fail'|'info'; detail: string }[] = []
  const { appKey, appSecret } = await req.json()

  // ── 用全小写key发请求（与签名计算完全一致）──
  const reqTime = String(Math.floor(Date.now() / 1000))

  // 试验A: 全小写key，展开
  const dataA = { page: 1, pagesize: 10 }
  const codeA = makeAuthcode(appKey, appSecret, reqTime, dataA)
  const bodyA = { appKey, ...dataA, reqTime, authcode: codeA }
  steps.push({ step: 'A. 全小写key展开: {page,pagesize}', status: 'info',
    detail: `body=${JSON.stringify(bodyA)}\nauthcode=${codeA}` })
  const rA = await callOMS(bodyA, '/v1/warehouse/options')
  steps.push({ step: 'A结果', status: rA.ok?'ok':'fail', detail: `code=${rA.code} msg=${rA.msg}\n${rA.raw}` })

  // 试验B: 全小写key，嵌套data
  const bodyB = { appKey, data: dataA, reqTime, authcode: codeA }
  const rB = await callOMS(bodyB, '/v1/warehouse/options')
  steps.push({ step: 'B. 全小写key嵌套data', status: rB.ok?'ok':'fail',
    detail: `body=${JSON.stringify(bodyB)}\ncode=${rB.code} msg=${rB.msg}\n${rB.raw}` })

  // 试验C: 空data，只有appKey+reqTime签名
  const dataC = {} as Record<string, any>
  const codeC = makeAuthcode(appKey, appSecret, reqTime, dataC)
  const bodyC = { appKey, page: 1, pageSize: 10, reqTime, authcode: codeC }
  const rC = await callOMS(bodyC, '/v1/warehouse/options')
  steps.push({ step: 'C. 签名用空data，业务参数单独传', status: rC.ok?'ok':'fail',
    detail: `body=${JSON.stringify(bodyC)}\nauthcode=${codeC}\ncode=${rC.code} msg=${rC.msg}\n${rC.raw}` })

  // 试验D: 只传appKey+reqTime，不传业务参数
  const dataD = {} as Record<string, any>
  const codeD = makeAuthcode(appKey, appSecret, reqTime, dataD)
  const bodyD = { appKey, reqTime, authcode: codeD }
  const rD = await callOMS(bodyD, '/v1/warehouse/options')
  steps.push({ step: 'D. 最简请求（无业务参数）', status: rD.ok?'ok':'fail',
    detail: `body=${JSON.stringify(bodyD)}\nauthcode=${codeD}\ncode=${rD.code} msg=${rD.msg}\n${rD.raw}` })

  return NextResponse.json({ steps })
}
