// app/api/lingxing/bind/route.ts
// 绑定领星账号 API 端点

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'
import { verifyAndBindCredentials } from '@/lib/lingxing'

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    // 验证登录
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: '请先登录' }, { status: 401 })
    }

    // 获取用户的 tenant_id
    const { data: userInfo } = await supabase
      .from('users')
      .select('tenant_id')
      .eq('id', user.id)
      .single()

    if (!userInfo?.tenant_id) {
      return NextResponse.json({ error: '用户未关联仓库账户' }, { status: 400 })
    }

    const { appKey, appSecret } = await req.json()

    if (!appKey || !appSecret) {
      return NextResponse.json({ error: 'AppKey 和 AppSecret 不能为空' }, { status: 400 })
    }

    // 验证并绑定
    const result = await verifyAndBindCredentials(userInfo.tenant_id, appKey, appSecret)

    if (!result.success) {
      return NextResponse.json({ error: result.message }, { status: 400 })
    }

    return NextResponse.json({
      success: true,
      message: result.message,
      warehouseCount: result.warehouseCount,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '服务器错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// 解绑领星账号
export async function DELETE(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const { data: userInfo } = await supabase
      .from('users').select('tenant_id').eq('id', user.id).single()

    if (!userInfo?.tenant_id) {
      return NextResponse.json({ error: '未找到账户信息' }, { status: 400 })
    }

    await supabase
      .from('lingxing_credentials')
      .update({
        access_token:   null,
        refresh_token:  null,
        auth_status:    0,
        sync_enabled:   false,
      })
      .eq('tenant_id', userInfo.tenant_id)

    return NextResponse.json({ success: true, message: '已成功解绑领星账号' })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '服务器错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// 获取绑定状态
export async function GET() {
  try {
    const supabase = getSupabaseServerClient()

    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const { data: userInfo } = await supabase
      .from('users').select('tenant_id').eq('id', user.id).single()

    if (!userInfo?.tenant_id) {
      return NextResponse.json({ bound: false })
    }

    const { data: cred } = await supabase
      .from('lingxing_credentials')
      .select('auth_status, last_sync_at, warehouse_ids, sync_enabled, token_expire_at')
      .eq('tenant_id', userInfo.tenant_id)
      .single()

    if (!cred || cred.auth_status === 0) {
      return NextResponse.json({ bound: false })
    }

    return NextResponse.json({
      bound:          true,
      authStatus:     cred.auth_status,
      lastSyncAt:     cred.last_sync_at,
      warehouseCount: (cred.warehouse_ids as string[])?.length ?? 0,
      syncEnabled:    cred.sync_enabled,
      tokenExpireAt:  cred.token_expire_at,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '服务器错误'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
