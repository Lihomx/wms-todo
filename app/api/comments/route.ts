/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const todoId = searchParams.get('todoId')
  if (!todoId) return NextResponse.json({ error: 'todoId required' }, { status: 400 })

  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('todo_comments')
    .select('*')
    .eq('todo_id', todoId)
    .order('created_at', { ascending: true })

  if (error) {
    // Table doesn't exist yet
    if (error.code === '42P01' || error.message.includes('does not exist')) {
      return NextResponse.json({ comments: [] })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ comments: data ?? [] })
}

export async function POST(req: NextRequest) {
  try {
    const { todo_id, content, author_name } = await req.json()
    if (!todo_id || !content?.trim()) {
      return NextResponse.json({ error: '缺少参数' }, { status: 400 })
    }

    // Auto-translate
    let content_zh = content.trim()
    let content_es = ''
    let original_lang = 'zh'

    try {
      const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://wms-todo-3nxq.vercel.app'
      const translateRes = await fetch(`${appUrl}/api/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: content.trim() })
      })
      if (translateRes.ok) {
        const t = await translateRes.json()
        content_zh    = t.content_zh ?? content.trim()
        content_es    = t.content_es ?? ''
        original_lang = t.sourceLang ?? 'zh'
      }
    } catch {
      // Translation failed - still save the comment
    }

    const supabase = getSupabaseAdminClient()

    // Insert without author_id dependency
    const { data, error } = await supabase
      .from('todo_comments')
      .insert({
        todo_id,
        author_name:      author_name ?? '仓库管理员',
        content_original: content.trim(),
        content_zh,
        content_es,
        original_lang,
      })
      .select()
      .single()

    if (error) {
      // Table doesn't exist - need migration
      if (error.code === '42P01' || error.message.includes('does not exist')) {
        return NextResponse.json({ error: '留言功能需要先执行数据库初始化，请联系管理员运行 migration 002' }, { status: 503 })
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    return NextResponse.json({ comment: data }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
