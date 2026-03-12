/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const { searchParams } = new URL(req.url)
    const status   = searchParams.get('status')
    const category = searchParams.get('category')
    const page     = parseInt(searchParams.get('page') || '1')
    const pageSize = parseInt(searchParams.get('pageSize') || '100')

    let query = supabase
      .from('todos')
      .select('*, checklist_items(id,content,is_done,sort_order)', { count: 'exact' })
      .order('created_at', { ascending: false })
      .range((page - 1) * pageSize, page * pageSize - 1)

    if (status   !== null && status   !== '') query = query.eq('status',   parseInt(status))
    if (category !== null && category !== '') query = query.eq('category', category)

    const { data, error, count } = await query
    if (error) throw error
    return NextResponse.json({ todos: data, total: count, page, pageSize })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '获取失败' }, { status: 500 })
  }
}

export async function POST(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const body = await req.json()
    const { title, category, priority, due_date, description, checklist, tenant_id, lingxing_order_no } = body
    if (!title || !category) return NextResponse.json({ error: '标题和分类不能为空' }, { status: 400 })

    const { data: todo, error } = await supabase.from('todos').insert({
      tenant_id: tenant_id || '00000000-0000-0000-0000-000000000001',
      title, category,
      priority:           priority ?? 2,
      due_date:           due_date ?? null,
      description:        description ?? null,
      lingxing_order_no:  lingxing_order_no ?? null,
      source:             'manual',
    }).select().single()

    if (error) throw error

    if (checklist && Array.isArray(checklist) && checklist.length > 0) {
      await supabase.from('checklist_items').insert(
        checklist.map((c: any, i: number) => ({ todo_id: todo.id, content: c.content, sort_order: i + 1 }))
      )
    }
    return NextResponse.json({ todo }, { status: 201 })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '创建失败' }, { status: 500 })
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const supabase = getSupabaseAdminClient()
    const body = await req.json()
    const { id, ...updates } = body
    if (!id) return NextResponse.json({ error: 'id 不能为空' }, { status: 400 })

    const patch: Record<string, any> = {}
    if (updates.status      !== undefined) { patch.status   = updates.status;   if (updates.status === 2) patch.completed_at = new Date().toISOString() }
    if (updates.priority    !== undefined)   patch.priority    = updates.priority
    if (updates.title       !== undefined)   patch.title       = updates.title
    if (updates.due_date    !== undefined)   patch.due_date    = updates.due_date
    if (updates.description !== undefined)   patch.description = updates.description
    if (updates.category    !== undefined)   patch.category    = updates.category

    const { data, error } = await supabase.from('todos').update(patch).eq('id', id).select().single()
    if (error) throw error
    return NextResponse.json({ todo: data })
  } catch (err: any) {
    return NextResponse.json({ error: err?.message ?? '更新失败' }, { status: 500 })
  }
}
