/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const todoId = searchParams.get('todoId')
  if (!todoId) return NextResponse.json({ error: 'todoId required' }, { status: 400 })

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('todo_comments')
    .select('*, author:user_profiles(display_name)')
    .eq('todo_id', todoId)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      return NextResponse.json({ comments: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const { todo_id, content, author_id } = await req.json()
    if (!todo_id || !content?.trim()) return NextResponse.json({ error: '缺少参数' }, { status: 400 })

    // Auto-translate via internal API
    const translateRes = await fetch(`${process.env.NEXT_PUBLIC_APP_URL ?? 'https://wms-todo-3nxq.vercel.app'}/api/translate`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text: content.trim() })
    })
    const translation = await translateRes.json()

    const supabase = getSupabaseAdminClient()
    
    // Use first user_profile as author if no author_id provided
    let authorId = author_id
    if (!authorId) {
      const { data: profiles } = await supabase.from('user_profiles').select('id').eq('tenant_id', DEFAULT_TENANT).limit(1)
      authorId = profiles?.[0]?.id ?? null
    }

    if (!authorId) {
      // Create a system user if none exists
      return NextResponse.json({ error: '请先创建员工账号才能发送留言' }, { status: 400 })
    }

    const { data, error } = await supabase.from('todo_comments').insert({
      todo_id,
      author_id:        authorId,
      content_original: content.trim(),
      content_zh:       translation.content_zh ?? content.trim(),
      content_es:       translation.content_es ?? '',
      original_lang:    translation.sourceLang ?? 'zh',
    }).select('*, author:user_profiles(display_name)').single()

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ comment: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
