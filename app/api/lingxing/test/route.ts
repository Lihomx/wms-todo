/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

// 正确签名算法：key转小写排序，拼values，HMAC-SHA256
function sign(appKey: string, appSecret: string, reqTime: string, data: Record<string, any>): string {
  const valuesStr = Object.entries(data)
    .map(([k, v]) => [k.toLowerCase(), v] as [string, any])
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, v]) => String(v))
    .join('')
  const strToSign = appKey + valuesStr + reqTime
  return createHmac('sha256', appSecret).update(strToSign).digest('hex')
}

export async function POST(req: NextRequest) {
  const steps: { step: string; status: 'ok' | 'fail' | 'info'; detail: string }[] = []

  try {
    const { appKey, appSecret } = await req.json()

    // Step 1: 环境变量
    const encSecret = process.env.ENCRYPTION_SECRET
    steps.push({
      step: '1. 环境变量 ENCRYPTION_SECRET',
      status: encSecret && encSecret.length >= 16 ? 'ok' : 'fail',
      detail: encSecret ? `已设置（长度 ${encSecret.length}）` : '❌ 未设置',
    })

    // Step 2: 生成签名
    const reqTime  = String(Math.floor(Date.now() / 1000))
    const testData = { page: 1, pageSize: 10 }
    const authcode = sign(appKey, appSecret, reqTime, testData)

    // 重现OMS验签工具的中间步骤
    const sortedEntries = Object.entries(testData)
      .map(([k, v]) => [k.toLowerCase(), v]).sort(([a], [b]) => (a as string).localeCompare(b as string))
    const valuesStr = sortedEntries.map(([, v]) => String(v)).join('')
    const strToSign = appKey + valuesStr + reqTime

    steps.push({
      step: '2. 生成签名 (HMAC-SHA256)',
      status: 'ok',
      detail: `reqTime=${reqTime}\n排序后key-value: ${JSON.stringify(sortedEntries)}\nstrToSign=${strToSign}\nauthcode=${authcode}`,
    })

    // Step 3: 请求体
    const requestBody = { appKey, ...testData, reqTime, authcode }
    steps.push({
      step: '3. 请求体结构',
      status: 'info',
      detail: JSON.stringify(requestBody, null, 2),
    })

    // Step 4: 仓库接口
    try {
      const res  = await fetch(`${API_BASE}/v1/warehouse/options`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const raw  = await res.text()
      const json = JSON.parse(raw)
      const code = json.code ?? json.status
      const ok   = code === 200 || code === 0 || code === '200' || code === '0'
      steps.push({ step: '4. 调用 /v1/warehouse/options', status: ok ? 'ok' : 'fail',
        detail: `HTTP ${res.status} | code=${code} | msg=${json.message ?? '-'}\n响应: ${raw.slice(0, 400)}` })
    } catch (e: any) {
      steps.push({ step: '4. 调用 /v1/warehouse/options', status: 'fail', detail: `网络错误: ${e.message}` })
    }

    // Step 5: 入库单接口
    const reqTime2  = String(Math.floor(Date.now() / 1000))
    const data2     = { page: 1, pageSize: 1 }
    const authcode2 = sign(appKey, appSecret, reqTime2, data2)
    try {
      const res  = await fetch(`${API_BASE}/v1/inboundOrder/pageList`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey, ...data2, reqTime: reqTime2, authcode: authcode2 }),
      })
      const raw  = await res.text()
      const json = JSON.parse(raw)
      const code = json.code ?? json.status
      const ok   = code === 200 || code === 0 || code === '200' || code === '0'
      steps.push({ step: '5. 调用 /v1/inboundOrder/pageList', status: ok ? 'ok' : 'fail',
        detail: `HTTP ${res.status} | code=${code} | msg=${json.message ?? '-'}\n响应: ${raw.slice(0, 400)}` })
    } catch (e: any) {
      steps.push({ step: '5. 调用 /v1/inboundOrder/pageList', status: 'fail', detail: `网络错误: ${e.message}` })
    }

    return NextResponse.json({ steps })
  } catch (e: any) {
    steps.push({ step: '解析请求', status: 'fail', detail: e.message })
    return NextResponse.json({ steps }, { status: 400 })
  }
}
