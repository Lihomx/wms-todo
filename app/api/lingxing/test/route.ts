/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

function makeAuthcode(appKey: string, appSecret: string, reqTime: string, data: Record<string,any>): string {
  const valuesStr = Object.entries(data)
    .map(([k,v])=>[k.toLowerCase(),v] as [string,any])
    .sort(([a],[b])=>a.localeCompare(b))
    .map(([,v])=>String(v)).join('')
  return createHmac('sha256', appSecret).update(appKey + valuesStr + reqTime).digest('hex')
}

export async function POST(req: NextRequest) {
  const steps: {step:string;status:'ok'|'fail'|'info';detail:string}[] = []
  const { appKey, appSecret } = await req.json()

  const reqTime  = '1773253660' // 固定值，方便和验签工具对比
  const data     = { page: 1, pagesize: 10 }
  const authcode = makeAuthcode(appKey, appSecret, reqTime, data)
  const body     = { appKey, ...data, reqTime, authcode }
  const bodyStr  = JSON.stringify(body)

  steps.push({ step: '发送的原始请求体', status: 'info', detail: bodyStr })
  steps.push({ step: '请求体字节长度', status: 'info', detail: `${new TextEncoder().encode(bodyStr).length} bytes` })
  steps.push({ step: 'authcode值', status: 'info', detail: authcode })
  steps.push({ step: '期望authcode', status: 'info', detail: '4009f25981d4e8fb72aeb6c64e43894ee32dc368c0eb19df56f59477dc312ca4' })
  steps.push({ step: '签名匹配', status: authcode === '4009f25981d4e8fb72aeb6c64e43894ee32dc368c0eb19df56f59477dc312ca4' ? 'ok' : 'fail',
    detail: authcode === '4009f25981d4e8fb72aeb6c64e43894ee32dc368c0eb19df56f59477dc312ca4' ? '✅ 完全匹配' : '❌ 不匹配' })

  // 发请求，打印完整响应头
  try {
    const res = await fetch(`${API_BASE}/v1/warehouse/options`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: bodyStr,
    })
    const raw = await res.text()

    // 打印所有响应头
    const headers: Record<string,string> = {}
    res.headers.forEach((v,k) => { headers[k] = v })

    steps.push({ step: 'HTTP状态码', status: 'info', detail: String(res.status) })
    steps.push({ step: '响应头', status: 'info', detail: JSON.stringify(headers, null, 2) })
    steps.push({ step: '响应体', status: res.ok ? 'ok' : 'fail', detail: raw })

    // 也试试用固定reqTime=1773250466（之前验签工具用过的）
    const reqTime2  = '1773250466'
    const authcode2 = makeAuthcode(appKey, appSecret, reqTime2, data)
    const body2     = { appKey, ...data, reqTime: reqTime2, authcode: authcode2 }
    const res2 = await fetch(`${API_BASE}/v1/warehouse/options`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body2),
    })
    const raw2 = await res2.text()
    steps.push({ step: '用旧reqTime=1773250466重试', status: 'info',
      detail: `authcode=${authcode2}\n响应: ${raw2}` })

  } catch(e:any) {
    steps.push({ step: '请求异常', status: 'fail', detail: e.message + '\n' + e.stack })
  }

  return NextResponse.json({ steps })
}
