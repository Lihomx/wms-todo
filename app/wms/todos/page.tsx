'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

interface CheckItem { id: string; content: string; is_done: boolean; sort_order: number }
interface Todo {
  id: string; title: string; category: string; priority: number; status: number
  due_date?: string; source: string; created_at: string
  checklist_items?: CheckItem[]
}

const PRI: Record<number, { label: string; color: string; border: string }> = {
  1: { label: '紧急', color: '#ef4444', border: '#7f1d1d44' },
  2: { label: '普通', color: '#3b82f6', border: '#1e40af44' },
  3: { label: '低优', color: '#64748b', border: '#2a3250' },
}
const STA: Record<number, { label: string; color: string }> = {
  0: { label: '待处理', color: '#f97316' },
  1: { label: '进行中', color: '#3b82f6' },
  2: { label: '已完成', color: '#22c55e' },
  3: { label: '已取消', color: '#64748b' },
}
const getPri = (n: number) => PRI[n] ?? PRI[2]
const getSta = (n: number) => STA[n] ?? STA[0]

function dateColor(due?: string): string {
  if (!due) return '#64748b'
  const t = new Date().toISOString().split('T')[0]
  if (due < t) return '#ef4444'
  if (due === t) return '#f97316'
  return '#64748b'
}

function TodosContent() {
  const searchParams = useSearchParams()
  const catParam     = searchParams.get('category') ?? ''

  const [todos,    setTodos]    = useState<Todo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Todo | null>(null)
  const [statusF,  setStatusF]  = useState('')
  const [catF,     setCatF]     = useState(catParam)

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ pageSize: '300' })
    if (statusF) p.set('status', statusF)
    if (catF)    p.set('category', catF)
    try {
      const res  = await fetch(`/api/todos?${p}`)
      const data = await res.json()
      const list: Todo[] = data.todos ?? []
      setTodos(list)
      if (list.length > 0 && !selected) setSelected(list[0])
    } catch { setTodos([]) }
    setLoading(false)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusF, catF])

  useEffect(() => { load() }, [load])
  useEffect(() => { setCatF(catParam) }, [catParam])

  const setStatus = async (id: string, status: number) => {
    await fetch('/api/todos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    load()
    if (selected?.id === id) setSelected(s => s ? { ...s, status } : s)
  }

  const toggleCheck = async (todoId: string, itemId: string, done: boolean) => {
    const sb = getSupabaseBrowserClient()
    await sb.from('checklist_items').update({ is_done: done }).eq('id', itemId)
    setSelected(s => s && s.id === todoId ? { ...s, checklist_items: s.checklist_items?.map(c => c.id === itemId ? { ...c, is_done: done } : c) } : s)
    setTodos(ts => ts.map(t => t.id === todoId ? { ...t, checklist_items: t.checklist_items?.map(c => c.id === itemId ? { ...c, is_done: done } : c) } : t))
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
      {/* Left list */}
      <div style={{ width: '420px', flexShrink: 0, borderRight: '1px solid #2a3250', display: 'flex', flexDirection: 'column' }}>
        <div style={{ padding: '14px 16px', borderBottom: '1px solid #2a3250' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
            <span style={{ fontSize: '14px', fontWeight: 700 }}>{catF || '全部待办'}</span>
            <span style={{ fontSize: '11px', background: '#1e40af22', color: '#3b82f6', padding: '2px 8px', borderRadius: '10px', fontWeight: 700 }}>{todos.length}</span>
            <button onClick={load} style={{ marginLeft: 'auto', background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>↻</button>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            {[
              { val: statusF, set: setStatusF, opts: [['', '全部状态'], ['0', '待处理'], ['1', '进行中'], ['2', '已完成']] },
            ].map(({ val, set, opts }, i) => (
              <select key={i} value={val} onChange={e => set(e.target.value)} style={{ flex: 1, background: '#0f1117', border: '1px solid #2a3250', color: '#94a3b8', fontSize: '12px', padding: '5px 8px', borderRadius: '6px', outline: 'none', cursor: 'pointer' }}>
                {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            ))}
          </div>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>加载中...</div>
          ) : todos.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#64748b' }}>
              <div style={{ fontSize: '32px', marginBottom: '12px' }}>✅</div>暂无待办
            </div>
          ) : todos.map(todo => {
            const pri      = getPri(todo.priority)
            const done     = todo.status === 2
            const chkDone  = todo.checklist_items?.filter(c => c.is_done).length ?? 0
            const chkTotal = todo.checklist_items?.length ?? 0
            return (
              <div key={todo.id} onClick={() => setSelected(todo)} style={{ padding: '12px 14px', borderRadius: '10px', cursor: 'pointer', border: `1px solid ${selected?.id === todo.id ? '#3b82f644' : 'transparent'}`, background: selected?.id === todo.id ? '#222840' : 'transparent', marginBottom: '3px', opacity: done ? 0.55 : 1 }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div onClick={e => { e.stopPropagation(); setStatus(todo.id, done ? 0 : 2) }} style={{ width: '20px', height: '20px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${done ? '#22c55e' : pri.color}`, background: done ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '1px', fontSize: '11px', color: 'white' }}>
                    {done ? '✓' : ''}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done ? 'line-through' : 'none', color: done ? '#64748b' : '#e2e8f0' }}>{todo.title}</div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '5px', flexWrap: 'wrap' as const }}>
                      {todo.due_date && <span style={{ fontSize: '11px', color: dateColor(todo.due_date), fontFamily: 'monospace' }}>📅 {todo.due_date}</span>}
                      <span style={{ fontSize: '11px', padding: '1px 7px', borderRadius: '4px', background: `${pri.color}15`, color: pri.color, border: `1px solid ${pri.border}`, fontWeight: 600 }}>{pri.label}</span>
                      <span style={{ fontSize: '11px', color: '#64748b', background: '#ffffff08', padding: '1px 6px', borderRadius: '4px' }}>{todo.category}</span>
                      {todo.source === 'lingxing_auto' && <span style={{ fontSize: '11px', color: '#06b6d4', background: '#06b6d411', padding: '1px 6px', borderRadius: '4px' }}>🤖 领星</span>}
                    </div>
                    {chkTotal > 0 && (
                      <div style={{ marginTop: '6px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#64748b', marginBottom: '3px' }}><span>{chkDone}/{chkTotal}</span><span>{Math.round(chkDone / chkTotal * 100)}%</span></div>
                        <div style={{ height: '3px', background: '#2a3250', borderRadius: '2px' }}>
                          <div style={{ height: '100%', borderRadius: '2px', width: `${chkDone / chkTotal * 100}%`, background: done ? '#22c55e' : '#3b82f6' }} />
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
            <div style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '12px', marginBottom: '10px' }}>
                <span style={{ padding: '3px 10px', borderRadius: '6px', fontSize: '12px', fontWeight: 700, background: `${getPri(selected.priority).color}15`, color: getPri(selected.priority).color, border: `1px solid ${getPri(selected.priority).border}`, flexShrink: 0 }}>{getPri(selected.priority).label}</span>
                <h2 style={{ fontSize: '16px', fontWeight: 700, lineHeight: 1.5 }}>{selected.title}</h2>
              </div>
              <div style={{ display: 'flex', gap: '12px', fontSize: '12px', color: '#64748b', flexWrap: 'wrap' as const }}>
                <span>📂 {selected.category}</span>
                {selected.due_date && <span style={{ color: dateColor(selected.due_date) }}>📅 {selected.due_date}</span>}
                <span>状态：<span style={{ color: getSta(selected.status).color }}>{getSta(selected.status).label}</span></span>
                <span>{selected.source === 'lingxing_auto' ? '🤖 领星自动' : '✋ 手动创建'}</span>
              </div>
            </div>

            <div style={{ display: 'flex', gap: '8px', marginBottom: '24px' }}>
              {[{ label: '进行中', s: 1, c: '#3b82f6' }, { label: '已完成', s: 2, c: '#22c55e' }, { label: '取消', s: 3, c: '#64748b' }].map(({ label, s, c }) => (
                <button key={s} onClick={() => setStatus(selected.id, s)} disabled={selected.status === s} style={{ padding: '7px 16px', borderRadius: '7px', border: `1px solid ${c}44`, background: selected.status === s ? `${c}22` : 'transparent', color: selected.status === s ? c : '#94a3b8', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}>{label}</button>
              ))}
            </div>

            {(selected.checklist_items?.length ?? 0) > 0 && (
              <div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '12px' }}>
                  📋 检查项（{selected.checklist_items?.filter(c => c.is_done).length ?? 0}/{selected.checklist_items?.length ?? 0}）
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                  {selected.checklist_items?.map(item => (
                    <div key={item.id} onClick={() => toggleCheck(selected.id, item.id, !item.is_done)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', background: '#1c2333', border: '1px solid #2a3250' }}>
                      <div style={{ width: '18px', height: '18px', borderRadius: '4px', flexShrink: 0, border: `2px solid ${item.is_done ? '#22c55e' : '#2a3250'}`, background: item.is_done ? '#22c55e' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', color: 'white' }}>{item.is_done ? '✓' : ''}</div>
                      <span style={{ fontSize: '13px', color: item.is_done ? '#64748b' : '#e2e8f0', textDecoration: item.is_done ? 'line-through' : 'none' }}>{item.content}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#64748b' }}>
            <div style={{ textAlign: 'center' }}><div style={{ fontSize: '40px', marginBottom: '12px' }}>📋</div>选择左侧待办查看详情</div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function TodosPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: '54px', borderBottom: '1px solid #2a3250', background: '#161b26', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px' }}>
        <span style={{ fontSize: '15px', fontWeight: 700 }}>待办计划</span>
        <a href="/wms/dashboard" style={{ marginLeft: 'auto', fontSize: '13px', color: '#64748b' }}>← 首页</a>
      </div>
      <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>加载中...</div>}>
        <TodosContent />
      </Suspense>
    </div>
  )
}
