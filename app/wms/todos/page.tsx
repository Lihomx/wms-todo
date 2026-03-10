'use client'
import { useEffect, useState, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface Todo {
  id: string
  title: string
  category: string
  priority: number
  status: number
  due_date?: string
  source: string
  created_at: string
  checklist_items?: { id: string; content: string; is_done: boolean }[]
}

const PRIORITY_MAP: Record<number, { label: string; color: string; border: string }> = {
  1: { label: '紧急', color: '#ef4444', border: '#7f1d1d44' },
  2: { label: '普通', color: '#3b82f6', border: '#1e40af44' },
  3: { label: '低优', color: '#64748b', border: '#2a3250' },
}

const STATUS_MAP: Record<number, { label: string; color: string }> = {
  0: { label: '待处理', color: '#f97316' },
  1: { label: '进行中', color: '#3b82f6' },
  2: { label: '已完成', color: '#22c55e' },
  3: { label: '已取消', color: '#64748b' },
}

function TodosContent() {
  const searchParams  = useSearchParams()
  const categoryParam = searchParams.get('category')

  const [todos,    setTodos]    = useState<Todo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Todo | null>(null)
  const [filter,   setFilter]   = useState({ status: '', priority: '', category: categoryParam ?? '' })

  const fetchTodos = useCallback(async () => {
    setLoading(true)
    const params = new URLSearchParams({ pageSize: '200' })
    if (filter.status)   params.set('status',   filter.status)
    if (filter.priority) params.set('priority', filter.priority)
    if (filter.category) params.set('category', filter.category)
    try {
      const res  = await fetch(`/api/todos?${params}`)
      const data = await res.json()
      setTodos(data.todos ?? [])
      if (data.todos?.length > 0) setSelected(data.todos[0])
    } catch { setTodos([]) }
    finally  { setLoading(false) }
  }, [filter])

  useEffect(() => { fetchTodos() }, [fetchTodos])
  useEffect(() => { setFilter(f => ({ ...f, category: categoryParam ?? '' })) }, [categoryParam])

  const handleStatusChange = async (todoId: string, status: number) => {
    await fetch('/api/todos', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: todoId, status }),
    })
    fetchTodos()
  }

  const toggleCheck = async (todoId: string, checkId: string, isDone: boolean) => {
    const supabase = (await import('@/lib/supabase-browser')).getSupabaseBrowserClient()
    await supabase.from('checklist_items').update({ is_done: isDone }).eq('id', checkId)
    // update local state
    setSelected(s => s && s.id === todoId ? {
      ...s,
      checklist_items: s.checklist_items?.map(c => c.id === checkId ? { ...c, is_done: isDone } : c)
    } : s)
  }

  const overdueOrToday = (due?: string) => {
    if (!due) return 'normal'
    const today = new Date().toISOString().split('T')[0]
    if (due < today) return 'overdue'
    if (due === today) return 'today'
    return 'normal'
  }

  const dateColor = (due?: string) => {
    const s = overdueOrToday(due)
    return s === 'overdue' ? '#ef4444' : s === 'today' ? '#f97316' : '#64748b'
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left panel */}
      <div style={{ width: '420px', flexShrink: 0, borderRight: '1px solid #2a3250', display: 'flex', flexDirection: 'column' }}>
        {/* Header */}
        <div style={{ padding: '16px 18px', borderBottom: '1px solid #2a3250' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '15px', fontWeight: 700 }}>
              {filter.category || '全部待办'}
            </span>
            <span style={{
              fontSize: '11px', fontFamily: 'monospace', fontWeight: 700,
              background: '#1e40af22', color: '#3b82f6', padding: '2px 8px', borderRadius: '10px',
            }}>{todos.length}</span>
            <button onClick={fetchTodos} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '14px' }}>↻</button>
          </div>
          {/* Filters */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { key: 'status', options: [['', '全部状态'], ['0', '待处理'], ['1', '进行中'], ['2', '已完成']] },
              { key: 'priority', options: [['', '全部优先级'], ['1', '紧急'], ['2', '普通']] },
            ].map(({ key, options }) => (
              <select
                key={key}
                value={filter[key as keyof typeof filter]}
                onChange={e => setFilter(f => ({ ...f, [key]: e.target.value }))}
                style={{
                  flex: 1, background: '#0f1117', border: '1px solid #2a3250',
                  color: '#94a3b8', fontSize: '12px', padding: '5px 8px',
                  borderRadius: '6px', outline: 'none', cursor: 'pointer',
                }}
              >
                {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>加载中...</div>
          ) : todos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>
              暂无待办事项
            </div>
          ) : todos.map(todo => {
            const pri = PRIORITY_MAP[todo.priority] ?? PRIORITY_MAP[2]
            const done = todo.status === 2
            const checkDone = (todo.checklist_items?.filter(c => c.is_done).length ?? 0)
            const checkTotal = (todo.checklist_items?.length ?? 0)
            return (
              <div
                key={todo.id}
                onClick={() => setSelected(todo)}
                style={{
                  padding: '12px 14px', borderRadius: '10px', cursor: 'pointer',
                  border: `1px solid ${selected?.id === todo.id ? '#3b82f644' : 'transparent'}`,
                  background: selected?.id === todo.id ? '#222840' : 'transparent',
                  marginBottom: '3px', transition: 'all .15s', opacity: done ? .55 : 1,
                }}
              >
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  {/* Status circle */}
                  <div
                    onClick={e => { e.stopPropagation(); handleStatusChange(todo.id, done ? 0 : 2) }}
                    style={{
                      width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0,
                      border: `2px solid ${done ? '#22c55e' : pri.color}`,
                      background: done ? '#22c55e' : 'transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', marginTop: '1px', fontSize: '11px', color: 'white',
                    }}
                  >{done ? '✓' : ''}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{
                      fontSize: '13.5px', fontWeight: 500, lineHeight: 1.4,
                      overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                      textDecoration: done ? 'line-through' : 'none',
                      color: done ? '#64748b' : '#e2e8f0',
                    }}>{todo.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '7px', marginTop: '5px', flexWrap: 'wrap' }}>
                      {todo.due_date && (
                        <span style={{ fontSize: '11px', color: dateColor(todo.due_date), fontFamily: 'monospace' }}>
                          📅 {todo.due_date}
                        </span>
                      )}
                      <span style={{
                        fontSize: '11px', padding: '1px 7px', borderRadius: '4px',
                        background: `${pri.color}15`, color: pri.color, border: `1px solid ${pri.border}`,
                        fontWeight: 600,
                      }}>{pri.label}</span>
                      <span style={{ fontSize: '11px', color: '#64748b', background: '#ffffff08', padding: '1px 6px', borderRadius: '4px' }}>
                        {todo.category}
                      </span>
                      {todo.source === 'lingxing_auto' && (
                        <span style={{ fontSize: '11px', color: '#06b6d4', background: '#06b6d411', padding: '1px 6px', borderRadius: '4px' }}>
                          🤖 领星
                        </span>
                      )}
                    </div>
                    {checkTotal > 0 && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: '3px', fontFamily: 'monospace' }}>
                          <span>{checkDone}/{checkTotal}</span>
                          <span>{Math.round(checkDone / checkTotal * 100)}%</span>
                        </div>
                        <div style={{ height: '3px', background: '#2a3250', borderRadius: '2px' }}>
                          <div style={{
                            height: '100%', borderRadius: '2px',
                            width: `${checkDone / checkTotal * 100}%`,
                            background: done ? '#22c55e' : '#3b82f6',
                            transition: 'width .3s',
                          }} />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right detail */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {selected ? (
          <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
            {/* Title */}
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                <span style={{
                  padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700,
                  background: `${PRIORITY_MAP[selected.priority]?.color}15`,
                  color: PRIORITY_MAP[selected.priority]?.color,
                  border: `1px solid ${PRIORITY_MAP[selected.priority]?.border}`,
                  flexShrink: 0,
                }}>{PRIORITY_MAP[selected.priority]?.label}</span>
                <h2 style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.5 }}>{selected.title}</h2>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b' }}>
                <span>📂 {selected.category}</span>
                {selected.due_date && <span style={{ color: dateColor(selected.due_date) }}>📅 {selected.due_date}</span>}
                <span>状态：<span style={{ color: STATUS_MAP[selected.status]?.color }}>{STATUS_MAP[selected.status]?.label}</span></span>
                <span>{selected.source === 'lingxing_auto' ? '🤖 领星自动创建' : '✋ 手动创建'}</span>
              </div>
            </div>

            {/* Quick actions */}
            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {[
                { label: '进行中', status: 1, color: '#3b82f6' },
                { label: '已完成', status: 2, color: '#22c55e' },
                { label: '取消',   status: 3, color: '#64748b' },
              ].map(({ label, status, color }) => (
                <button
                  key={status}
                  onClick={() => handleStatusChange(selected.id, status)}
                  disabled={selected.status === status}
                  style={{
                    padding: '7px 16px', borderRadius: '7px', border: `1px solid ${color}44`,
                    background: selected.status === status ? `${color}22` : 'transparent',
                    color: selected.status === status ? color : '#94a3b8',
                    fontSize: '12px', fontWeight: 600, cursor: 'pointer', transition: 'all .15s',
                  }}
                >{label}</button>
              ))}
            </div>

            {/* Checklist */}
            {(selected.checklist_items?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '12px' }}>
                  📋 检查项（{selected.checklist_items?.filter(c => c.is_done).length}/{selected.checklist_items?.length}）
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selected.checklist_items?.map(item => (
                    <div
                      key={item.id}
                      onClick={() => toggleCheck(selected.id, item.id, !item.is_done)}
                      style={{
                        display: 'flex', alignItems: 'center', gap: '10px',
                        padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                        background: '#1c2333', border: '1px solid #2a3250',
                        transition: 'background .15s',
                      }}
                    >
                      <div style={{
                        width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0,
                        border: `2px solid ${item.is_done ? '#22c55e' : '#2a3250'}`,
                        background: item.is_done ? '#22c55e' : 'transparent',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '11px', color: 'white',
                      }}>{item.is_done ? '✓' : ''}</div>
                      <span style={{
                        fontSize: '13px',
                        color: item.is_done ? '#64748b' : '#e2e8f0',
                        textDecoration: item.is_done ? 'line-through' : 'none',
                      }}>{item.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>
              <div>选择左侧待办查看详情</div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TodosPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Topbar */}
      <div style={{
        height: '54px', borderBottom: '1px solid #2a3250',
        background: '#161b26', display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: '12px',
      }}>
        <span style={{ fontSize: '15px', fontWeight: 700 }}>待办计划</span>
        <a href="/wms/todos" style={{ padding: '5px 12px', borderRadius: '6px', fontSize: '13px', background: '#222840', color: '#3b82f6', cursor: 'pointer' }}>全部</a>
        <a href="/wms/dashboard" style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>← 返回首页</a>
      </div>
      <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>加载中...</div>}>
        <TodosContent />
      </Suspense>
    </div>
  )
}
