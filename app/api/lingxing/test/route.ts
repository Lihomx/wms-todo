/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { createHmac } from 'crypto'

const API_BASE = 'https://api.xlwms.com/openapi'

export async function POST(req: NextRequest) {
  const steps: { step: string; status: 'ok' | 'fail' | 'info'; detail: string }[] = []

  try {
    const { appKey, appSecret } = await req.json()

    // ── Step 1: 检查环境变量 ─────────────────────────────────
    const encSecret = process.env.ENCRYPTION_SECRET
    steps.push({
      step: '1. 环境变量 ENCRYPTION_SECRET',
      status: encSecret && encSecret.length >= 16 ? 'ok' : 'fail',
      detail: encSecret ? `已设置（长度 ${encSecret.length}）` : '❌ 未设置！请在 Vercel 环境变量中添加',
    })

    // ── Step 2: 生成签名 ─────────────────────────────────────
    const reqTime = String(Math.floor(Date.now() / 1000))
    const testData = { page: 1, pageSize: 10 }
    const sortedData = Object.fromEntries(Object.entries(testData).sort(([a], [b]) => a.localeCompare(b)))
    const strToSign = appKey + JSON.stringify(sortedData) + reqTime
    const authCode = createHmac('sha256', appSecret).update(strToSign).digest('hex')

    steps.push({
      step: '2. 生成签名 (HMAC-SHA256)',
      status: 'ok',
      detail: `reqTime=${reqTime}\nstrToSign=${strToSign}\nauthCode=${authCode}`,
    })

    // ── Step 3: 构建请求体 ───────────────────────────────────
    const requestBody = { appKey, data: testData, reqTime, authcode: authCode }
    steps.push({
      step: '3. 请求体结构',
      status: 'info',
      detail: JSON.stringify(requestBody, null, 2),
    })

    // ── Step 4: 调用仓库列表接口 ─────────────────────────────
    let warehouseResult = ''
    try {
      const res = await fetch(`${API_BASE}/v1/warehouse/options`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })
      const raw = await res.text()
      let json: any = {}
      try { json = JSON.parse(raw) } catch { /* ignore */ }

      const code = json.code ?? json.status
      const success = code === 200 || code === 0 || code === '200' || code === '0'
      warehouseResult = `HTTP ${res.status} | code=${code} | msg=${json.message ?? json.msg ?? '-'}\n响应: ${raw.slice(0, 300)}`
      steps.push({
        step: '4. 调用 /v1/warehouse/options',
        status: success ? 'ok' : 'fail',
        detail: warehouseResult,
      })
    } catch (e: any) {
      steps.push({ step: '4. 调用 /v1/warehouse/options', status: 'fail', detail: `网络错误: ${e.message}` })
    }

    // ── Step 5: 调用入库单接口 ───────────────────────────────
    const reqTime2 = String(Math.floor(Date.now() / 1000))
    const inboundData = { page: 1, pageSize: 1 }
    const sortedData2 = Object.fromEntries(Object.entries(inboundData).sort(([a], [b]) => a.localeCompare(b)))
    const strToSign2 = appKey + JSON.stringify(sortedData2) + reqTime2
    const authCode2  = createHmac('sha256', appSecret).update(strToSign2).digest('hex')

    try {
      const res = await fetch(`${API_BASE}/v1/inboundOrder/pageList`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey, data: inboundData, reqTime: reqTime2, authcode: authCode2 }), 
      })
      const raw = await res.text()
      let json: any = {}
      try { json = JSON.parse(raw) } catch { /* ignore */ }

      const code = json.code ?? json.status
      const success = code === 200 || code === 0 || code === '200' || code === '0'
      steps.push({
        step: '5. 调用 /v1/inboundOrder/pageList',
        status: success ? 'ok' : 'fail',
        detail: `HTTP ${res.status} | code=${code} | msg=${json.message ?? json.msg ?? '-'}\n响应: ${raw.slice(0, 300)}`,
      })
    } catch (e: any) {
      steps.push({ step: '5. 调用 /v1/inboundOrder/pageList', status: 'fail', detail: `网络错误: ${e.message}` })
    }

    return NextResponse.json({ steps })
  } catch (e: any) {
    steps.push({ step: '解析请求', status: 'fail', detail: e.message })
    return NextResponse.json({ steps }, { status: 400 })
  }
}
