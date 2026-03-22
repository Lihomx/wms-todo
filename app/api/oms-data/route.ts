/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'
import { generateAuthcode } from '@/lib/lingxing'
import { decrypt } from '@/lib/crypto'

const API_BASE = 'https://api.xlwms.com/openapi'
const today  = () => new Date().toISOString().split('T')[0]
const start180 = () => new Date(Date.now()-180*864e5).toISOString().split('T')[0]

async function omsPost(appKey:string,appSecret:string,endpoint:string,data:Record<string,any>={}) {
  const reqTime = String(Math.floor(Date.now()/1000))
  const authcode = generateAuthcode(appKey, appSecret, reqTime, data)
  const body = Object.keys(data).length>0 ? {appKey,data,reqTime} : {appKey,reqTime}
  const res = await fetch(`${API_BASE}${endpoint}?authcode=${authcode}`,{
    method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify(body)
  })
  const json = await res.json()
  const code = json.code ?? json.status
  if(code!==200&&code!==0&&code!=='200'&&code!=='0') {
    const msg = json.message ?? json.msg ?? String(code)
    const err = new Error(msg) as any
    err.omsCode = String(code)
    throw err
  }
  return json.data ?? json
}

async function fetchPages(appKey:string,appSecret:string,endpoint:string,params:Record<string,any>={},maxPageSize=50,maxPages=3) {
  const all:any[] = []
  for(let page=1; page<=maxPages; page++) {
    const data = await omsPost(appKey, appSecret, endpoint, {...params, page, pageSize:maxPageSize})
    const items:any[] = Array.isArray(data) ? data : (data?.list??data?.records??data?.rows??[])
    all.push(...items)
    const total = Number(data?.total??data?.totalCount??0)
    if(items.length < maxPageSize || (total>0 && all.length>=total)) break
  }
  return all
}

async function getCredentials(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const customerCode = searchParams.get('customerCode') || req.headers.get('X-Impersonate-Customer')
  const supabase = getSupabaseAdminClient()
  if (!customerCode) return null
  const { data: client } = await supabase.from('oms_clients')
    .select('app_key,app_secret,auth_status,customer_code,customer_name')
    .eq('customer_code', customerCode).eq('auth_status',1).single()
  if (!client?.app_key) return null
  return { appKey: decrypt(client.app_key), appSecret: decrypt(client.app_secret), customerCode }
}

export async function GET(req: NextRequest) {
  const type = new URL(req.url).searchParams.get('type') || 'inventory'
  const cred = await getCredentials(req)
  if (!cred) return NextResponse.json({ error: '未绑定AppKey或无权限' }, { status: 401 })
  const { appKey, appSecret } = cred

  try {
    if (type === 'inventory') {
      const items = await fetchPages(appKey, appSecret, '/v1/integratedInventory/pageOpen', {
        startTime: `${start180()} 00:00:00`, endTime: `${today()} 23:59:59`
      }, 50, 10)
      return NextResponse.json({ items, total: items.length })
    }

    if (type === 'products') {
      const items = await fetchPages(appKey, appSecret, '/v1/product/pageList', { approveStatus: 2 }, 100, 5)
      return NextResponse.json({ items, total: items.length })
    }

    if (type === 'inbound') {
      const page    = Number(new URL(req.url).searchParams.get('page') || 1)
      const status  = new URL(req.url).searchParams.get('status')
      const inboundType = new URL(req.url).searchParams.get('inboundType')
      const params: any = { page, pageSize: 20,
        startTime: `${start180()} 00:00:00`, endTime: `${today()} 23:59:59` }
      if (status)      params.status      = Number(status)
      if (inboundType) params.inboundType = Number(inboundType)
      const data = await omsPost(appKey, appSecret, '/v1/inboundOrder/pageList', params)
      const items = data?.records ?? data?.list ?? []
      return NextResponse.json({ items, total: data?.total ?? items.length, page })
    }

    return NextResponse.json({ error: `未知类型: ${type}` }, { status: 400 })
  } catch(e:any) {
    const isPermError = e.omsCode==='100010' || String(e.message).includes('无接口权限') || String(e.message).includes('11008')
    return NextResponse.json({
      error: isPermError
        ? `此AppKey暂无「${type}」接口权限 (${e.message})`
        : e.message,
      omsCode: e.omsCode,
      isPermError,
    }, { status: 500 })
  }
}
