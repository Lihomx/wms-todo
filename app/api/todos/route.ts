// app/api/todos/route.ts
// 待办事项 CRUD API

import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseServerClient } from '@/lib/supabase'

// ── 获取待办列表 ──────────────────────────────────────────────
export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const { searchParams } = new URL(req.url)
    const status    = searchParams.get('status')    // 0/1/2/3
    const category  = searchParams.get('category')  // 入库作业/出库作业/...
    const priority  = searchParams.get('priority')  // 1/2/3
    const page      = parseInt(searchParams.get('page') || '1')
    const pageSize  = parseInt(searchParams.get('pageSize') || '50')

    let query = supabase
      .from('todos')
      .select(`
        *,
        checklist_items (
          id, content, is_done, due_date, sort_order
        )
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (status !== null)   query = query.eq('status', parseInt(status))
    if (category)          query = query.eq('category', category)
    if (priority !== null) query = query.eq('priority', parseInt(priority))

    const { data, error, count } = await query

    if (error) throw error

    return NextResponse.json({
      todos: data,
      total: count,
      page,
      pageSize,
    })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '获取失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── 新建待办 ──────────────────────────────────────────────────
export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const { data: userInfo } = await supabase
      .from('users').select('tenant_id').eq('id', user.id).single()

    const body = await req.json()
    const { title, category, priority, due_date, description, checklist } = body

    if (!title || !category) {
      return NextResponse.json({ error: '标题和分类不能为空' }, { status: 400 })
    }

    // 创建待办
    const { data: todo, error } = await supabase
      .from('todos')
      .insert({
        tenant_id:   userInfo?.tenant_id,
        title,
        category,
        priority:    priority ?? 2,
        due_date:    due_date ?? null,
        description: description ?? null,
        source:      'manual',
        created_by:  user.id,
      })
      .select()
      .single()

    if (error) throw error

    // 批量创建检查项
    if (checklist && checklist.length > 0) {
      await supabase.from('checklist_items').insert(
        checklist.map((item: { content: string; due_date?: string }, i: number) => ({
          todo_id:    todo.id,
          content:    item.content,
          due_date:   item.due_date ?? null,
          sort_order: i + 1,
        }))
      )
    }

    // 返回完整数据
    const { data: fullTodo } = await supabase
      .from('todos')
      .select('*, checklist_items(*)')
      .eq('id', todo.id)
      .single()

    return NextResponse.json({ todo: fullTodo }, { status: 201 })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '创建失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

// ── 更新待办状态 ──────────────────────────────────────────────
export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseServerClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: '请先登录' }, { status: 401 })

    const body = await req.json()
    const { id, status, priority, title, due_date } = body

    if (!id) return NextResponse.json({ error: 'id 不能为空' }, { status: 400 })

    const updateData: Record<string, unknown> = {}
    if (status    !== undefined) updateData.status    = status
    if (priority  !== undefined) updateData.priority  = priority
    if (title     !== undefined) updateData.title     = title
    if (due_date  !== undefined) updateData.due_date  = due_date

    // 完成时记录时间
    if (status === 2) updateData.completed_at = new Date().toISOString()

    const { data, error } = await supabase
      .from('todos')
      .update(updateData)
      .eq('id', id)
      .select()
      .single()

    if (error) throw error

    return NextResponse.json({ todo: data })

  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : '更新失败'
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
