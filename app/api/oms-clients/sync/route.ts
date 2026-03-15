import { NextResponse } from 'next/server'
export async function POST() {
  return NextResponse.json({ message: '请使用 /api/oms-clients/sync-data 接口并传入 clientId' })
}
