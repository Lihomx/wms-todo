'use client'
import { useEffect, useState, useCallback, Suspense } from 'react'
import { useSearchParams, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import Link from 'next/link'

interface CheckItem { id: string; content: string; is_done: boolean; sort_order: number }
interface Todo {
  id: string; title: string; category: string; priority: number; status: number
  due_date?: string; description?: string; source: string; created_at: string
  lingxing_order_no?: string
  checklist_items?: CheckItem[]
}

const CATS = ['入库作业','出库作业','库存管理','退货处理','工单审批','其他']
const CAT_ICONS: Record<string,string> = { '入库作业':'📦','出库作业':'🚚','库存管理':'📊','退货处理':'↩️','工单审批':'📋','其他':'⚡' }
const PRI_MAP: Record<number,{label:string;color:string}> = { 1:{label:'紧急',color:'#ef4444'}, 2:{label:'普通',color:'#3b82f6'}, 3:{label:'低优',color:'#64748b'} }
const STA_MAP: Record<number,{label:string;color:string}> = { 0:{label:'待处理',color:'#f97316'}, 1:{label:'进行中',color:'#3b82f6'}, 2:{label:'已完成',color:'#22c55e'}, 3:{label:'已取消',color:'#475569'} }
const getPri = (n:number) => PRI_MAP[n] ?? PRI_MAP[2]
const getSta = (n:number) => STA_MAP[n] ?? STA_MAP[0]
const today = new Date().toISOString().split('T')[0]
const dueCls = (d?:string) => !d ? '#64748b' : d < today ? '#ef4444' : d === today ? '#f97316' : '#64748b'

function EditModal({ todo, onClose, onSaved }: { todo: Todo; onClose: ()=>void; onSaved: ()=>void }) {
  const [title,    setTitle]    = useState(todo.title)
  const [category, setCat]      = useState(todo.category)
  const [priority, setPri]      = useState(todo.priority)
  const [dueDate,  setDue]      = useState(todo.due_date ?? '')
  const [desc,     setDesc]     = useState(todo.description ?? '')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const save = async () => {
    if (!title.trim()) { setError('标题不能为空'); return }
    setSaving(true)
    try {
      const res = await fetch('/api/todos', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: todo.id, title: title.trim(), category, priority, due_date: dueDate || null, description: desc || null }),
      })
      if (!res.ok) throw new Error('保存失败')
      onSaved()
      onClose()
    } catch(e:any) { setError(e.message) }
    setSaving(false)
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#000000bb', zIndex: 100, display: 'flex', alignItems: 'center', justifyContent: 'center' }} onClick={onClose}>
      <div style={{ background: '#161b26', border: '1px solid #2a3250', borderRadius: '14px', width: '500px', maxWidth: '94vw', padding: '28px' }} onClick={e=>e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h3 style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>编辑待办</h3>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '20px', lineHeight: 1 }}>×</button>
        </div>
        {error && <div style={{ marginBottom: '12px', padding: '8px 12px', background: '#ef444422', border: '1px solid #ef444444', borderRadius: '6px', color: '#ef4444', fontSize: '12px' }}>{error}</div>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          <div>
            <label style={lbl}>标题 *</label>
            <input value={title} onChange={e=>setTitle(e.target.value)} style={inp} placeholder="待办标题" />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div>
              <label style={lbl}>业务分类</label>
              <select value={category} onChange={e=>setCat(e.target.value)} style={inp}>
                {CATS.map(c=><option key={c} value={c}>{CAT_ICONS[c]} {c}</option>)}
              </select>
            </div>
            <div>
              <label style={lbl}>优先级</label>
              <select value={priority} onChange={e=>setPri(Number(e.target.value))} style={inp}>
                <option value={1}>🔴 紧急</option>
                <option value={2}>🔵 普通</option>
                <option value={3}>⚫ 低优</option>
              </select>
            </div>
          </div>
          <div>
            <label style={lbl}>截止日期</label>
            <input type="date" value={dueDate} onChange={e=>setDue(e.target.value)} style={inp} />
          </div>
          <div>
            <label style={lbl}>备注说明</label>
            <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={3} style={{ ...inp, resize: 'vertical' as const }} placeholder="可选备注..." />
          </div>
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button onClick={onClose} style={{ padding: '8px 18px', borderRadius: '7px', background: 'none', border: '1px solid #2a3250', color: '#64748b', cursor: 'pointer', fontSize: '13px' }}>取消</button>
          <button onClick={save} disabled={saving} style={{ padding: '8px 18px', borderRadius: '7px', background: '#3b82f6', border: 'none', color: 'white', cursor: saving?'not-allowed':'pointer', fontSize: '13px', fontWeight: 700, opacity: saving?0.6:1 }}>{saving?'保存中...':'保存'}</button>
        </div>
      </div>
    </div>
  )
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 600, color: '#64748b', marginBottom: '6px', textTransform: 'uppercase', letterSpacing: '0.5px' }
const inp: React.CSSProperties = { width: '100%', background: '#0d1117', border: '1px solid #2a3250', borderRadius: '7px', padding: '9px 12px', color: '#e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }

function AddCheckItem({ todoId, onAdded }: { todoId: string; onAdded: ()=>void }) {
  const [val, setVal] = useState('')
  const add = async () => {
    if (!val.trim()) return
    const sb = getSupabaseBrowserClient()
    await sb.from('checklist_items').insert({ todo_id: todoId, content: val.trim(), sort_order: 99 })
    setVal('')
    onAdded()
  }
  return (
    <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
      <input value={val} onChange={e=>setVal(e.target.value)} onKeyDown={e=>e.key==='Enter'&&add()} placeholder="新增检查项..." style={{ ...inp, flex: 1, fontSize: '12px', padding: '7px 10px' }} />
      <button onClick={add} style={{ padding: '7px 14px', borderRadius: '6px', background: '#1e3a5f', border: '1px solid #3b82f644', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>+ 添加</button>
    </div>
  )
}

function TodosContent() {
  const searchParams = useSearchParams()
  const router       = useRouter()
  const catParam     = searchParams.get('category') ?? ''
  const idParam      = searchParams.get('id') ?? ''

  const [todos,    setTodos]    = useState<Todo[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<Todo | null>(null)
  const [editing,  setEditing]  = useState(false)
  const [search,   setSearch]   = useState('')
  const [statusF,  setStatusF]  = useState('')
  const [catF,     setCatF]     = useState(catParam)
  const [priF,     setPriF]     = useState('')
  const [groupBy,  setGroupBy]  = useState<'category'|'status'|'priority'>('category')

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({ pageSize: '500' })
    if (statusF) p.set('status', statusF)
    if (catF)    p.set('category', catF)
    try {
      const res  = await fetch(`/api/todos?${p}`)
      const data = await res.json()
      const list: Todo[] = data.todos ?? []
      setTodos(list)
    } catch { setTodos([]) }
    setLoading(false)
  }, [statusF, catF])

  useEffect(() => { load() }, [load])
  useEffect(() => { setCatF(catParam) }, [catParam])
  useEffect(() => {
    if (idParam && todos.length > 0) {
      const found = todos.find(t=>t.id===idParam)
      if (found) setSelected(found)
    }
  }, [idParam, todos])

  const filtered = todos.filter(t => {
    if (search && !t.title.toLowerCase().includes(search.toLowerCase())) return false
    if (priF && String(t.priority) !== priF) return false
    return true
  })

  // Group todos
  const grouped: { key: string; label: string; color: string; items: Todo[] }[] = []
  if (groupBy === 'category') {
    const keys = catF ? [catF] : CATS
    keys.forEach(k => {
      const items = filtered.filter(t=>t.category===k)
      if (items.length > 0 || !catF) grouped.push({ key: k, label: `${CAT_ICONS[k]||'📁'} ${k}`, color: '#3b82f6', items })
    })
    const others = filtered.filter(t=>!CATS.includes(t.category))
    if (others.length > 0) grouped.push({ key: 'other', label: '📁 其他分类', color: '#64748b', items: others })
  } else if (groupBy === 'status') {
    [0,1,2,3].forEach(s => {
      const items = filtered.filter(t=>t.status===s)
      if (items.length > 0) grouped.push({ key: String(s), label: getSta(s).label, color: getSta(s).color, items })
    })
  } else {
    [1,2,3].forEach(p => {
      const items = filtered.filter(t=>t.priority===p)
      if (items.length > 0) grouped.push({ key: String(p), label: getPri(p).label, color: getPri(p).color, items })
    })
  }

  const setStatus = async (id: string, status: number) => {
    await fetch('/api/todos', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status }) })
    load()
    setSelected(s => s && s.id === id ? { ...s, status } : s)
  }

  const deleteTodo = async (id: string) => {
    if (!confirm('确认删除此待办？')) return
    const sb = getSupabaseBrowserClient()
    await sb.from('todos').delete().eq('id', id)
    setSelected(null)
    load()
  }

  const toggleCheck = async (todoId: string, itemId: string, done: boolean) => {
    const sb = getSupabaseBrowserClient()
    await sb.from('checklist_items').update({ is_done: done }).eq('id', itemId)
    const upd = (t: Todo) => t.id===todoId ? {...t, checklist_items: t.checklist_items?.map(c=>c.id===itemId?{...c,is_done:done}:c)} : t
    setSelected(s => s ? upd(s) : s)
    setTodos(ts => ts.map(upd))
  }

  const reloadSelected = async () => {
    if (!selected) return
    await load()
    const res  = await fetch(`/api/todos?pageSize=500`)
    const data = await res.json()
    const found = (data.todos??[]).find((t:Todo)=>t.id===selected.id)
    if (found) setSelected(found)
  }

  const selectTodo = (t: Todo) => {
    setSelected(t)
    router.replace(`/wms/todos?${catF?'category='+encodeURIComponent(catF)+'&':''}id=${t.id}`, { scroll: false })
  }

  return (
    <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

      {/* ── Left Panel ── */}
      <div style={{ width: '400px', flexShrink: 0, borderRight: '1px solid #1e2535', display: 'flex', flexDirection: 'column', background: '#0d1117' }}>

        {/* Toolbar */}
        <div style={{ padding: '12px 14px', borderBottom: '1px solid #1e2535', display: 'flex', flexDirection: 'column', gap: '9px' }}>
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <div style={{ flex: 1, position: 'relative' }}>
              <span style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', color: '#475569', fontSize: '13px' }}>🔍</span>
              <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索待办..." style={{ ...inp, paddingLeft: '30px', fontSize: '12px', padding: '7px 10px 7px 30px' }} />
            </div>
            <Link href="/wms/todos/new" style={{ padding: '7px 13px', borderRadius: '7px', background: '#3b82f6', color: 'white', fontSize: '12px', fontWeight: 700, textDecoration: 'none', flexShrink: 0, whiteSpace: 'nowrap' }}>+ 新建</Link>
          </div>
          <div style={{ display: 'flex', gap: '6px' }}>
            <select value={statusF} onChange={e=>setStatusF(e.target.value)} style={{ ...inp, fontSize: '11px', padding: '5px 8px', flex: 1 }}>
              <option value="">全部状态</option>
              <option value="0">待处理</option>
              <option value="1">进行中</option>
              <option value="2">已完成</option>
            </select>
            <select value={priF} onChange={e=>setPriF(e.target.value)} style={{ ...inp, fontSize: '11px', padding: '5px 8px', flex: 1 }}>
              <option value="">全部优先级</option>
              <option value="1">🔴 紧急</option>
              <option value="2">🔵 普通</option>
              <option value="3">⚫ 低优</option>
            </select>
            <select value={groupBy} onChange={e=>setGroupBy(e.target.value as any)} style={{ ...inp, fontSize: '11px', padding: '5px 8px', flex: 1 }}>
              <option value="category">按分类</option>
              <option value="status">按状态</option>
              <option value="priority">按优先级</option>
            </select>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span style={{ fontSize: '11px', color: '#475569' }}>{catF || '全部待办'} · {filtered.length} 条</span>
            <button onClick={load} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px' }} title="刷新">↻</button>
          </div>
        </div>

        {/* List */}
        <div style={{ flex: 1, overflowY: 'auto' }}>
          {loading ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>加载中...</div>
          ) : filtered.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
              <div style={{ fontSize: '28px', marginBottom: '10px' }}>📭</div>
              <div style={{ fontSize: '13px', marginBottom: '12px' }}>暂无匹配待办</div>
              <Link href="/wms/todos/new" style={{ fontSize: '12px', color: '#3b82f6', textDecoration: 'none' }}>+ 新建待办</Link>
            </div>
          ) : grouped.map(g => (
            <div key={g.key}>
              {/* Group Header */}
              {grouped.length > 1 && (
                <div style={{ padding: '8px 14px 6px', display: 'flex', alignItems: 'center', gap: '8px', position: 'sticky', top: 0, background: '#0d1117', zIndex: 1, borderBottom: '1px solid #1e2535' }}>
                  <span style={{ fontSize: '12px', fontWeight: 700, color: '#94a3b8' }}>{g.label}</span>
                  <span style={{ fontSize: '10px', background: `${g.color}22`, color: g.color, padding: '1px 7px', borderRadius: '8px', fontWeight: 700 }}>{g.items.length}</span>
                </div>
              )}
              {g.items.map(todo => {
                const pri  = getPri(todo.priority)
                const sta  = getSta(todo.status)
                const done = todo.status === 2
                const chkDone  = todo.checklist_items?.filter(c=>c.is_done).length ?? 0
                const chkTotal = todo.checklist_items?.length ?? 0
                const isOver   = todo.due_date && todo.due_date < today
                const isActive = selected?.id === todo.id
                return (
                  <div key={todo.id} onClick={() => selectTodo(todo)} style={{ padding: '11px 14px', cursor: 'pointer', borderBottom: '1px solid #1a2035', borderLeft: `3px solid ${isActive ? pri.color : 'transparent'}`, background: isActive ? '#161b26' : 'transparent', opacity: done ? 0.6 : 1, transition: 'background 0.1s' }}
                    onMouseEnter={e=>{ if(!isActive) e.currentTarget.style.background='#0f1520' }}
                    onMouseLeave={e=>{ if(!isActive) e.currentTarget.style.background='transparent' }}>
                    <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                      {/* Circle status button */}
                      <div onClick={e=>{e.stopPropagation();setStatus(todo.id, done?0:2)}} style={{ width: '18px', height: '18px', borderRadius: '50%', flexShrink: 0, border: `2px solid ${done?'#22c55e':pri.color}`, background: done?'#22c55e':'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', marginTop: '1px', fontSize: '10px', color: 'white' }}>
                        {done && '✓'}
                      </div>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', textDecoration: done?'line-through':'none', color: done?'#475569':'#e2e8f0' }}>{todo.title}</div>
                        <div style={{ display: 'flex', gap: '5px', marginTop: '4px', alignItems: 'center', flexWrap: 'wrap' as const }}>
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: `${pri.color}18`, color: pri.color, fontWeight: 700 }}>{pri.label}</span>
                          <span style={{ fontSize: '10px', padding: '1px 6px', borderRadius: '3px', background: `${sta.color}18`, color: sta.color }}>{sta.label}</span>
                          {todo.due_date && <span style={{ fontSize: '10px', color: dueCls(todo.due_date) }}>{isOver?'⚠ ':''}{todo.due_date}</span>}
                          {todo.source==='lingxing_auto' && <span style={{ fontSize: '10px', color: '#06b6d4' }}>领星</span>}
                        </div>
                        {chkTotal > 0 && (
                          <div style={{ marginTop: '5px' }}>
                            <div style={{ height: '2px', background: '#1e2535', borderRadius: '1px' }}>
                              <div style={{ height: '100%', borderRadius: '1px', width: `${chkDone/chkTotal*100}%`, background: done?'#22c55e':'#3b82f6' }} />
                            </div>
                            <span style={{ fontSize: '9px', color: '#475569' }}>{chkDone}/{chkTotal}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>

      {/* ── Right Detail Panel ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', background: '#0b0f1a' }}>
        {selected ? (
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {/* Detail Header */}
            <div style={{ padding: '20px 24px', borderBottom: '1px solid #1e2535', background: '#0d1117' }}>
              <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: '12px' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '8px', flexWrap: 'wrap' as const }}>
                    <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '4px', background: `${getPri(selected.priority).color}18`, color: getPri(selected.priority).color, fontWeight: 700, border: `1px solid ${getPri(selected.priority).color}33` }}>{getPri(selected.priority).label}</span>
                    <span style={{ fontSize: '11px', padding: '2px 9px', borderRadius: '4px', background: `${getSta(selected.status).color}18`, color: getSta(selected.status).color }}>{getSta(selected.status).label}</span>
                    <span style={{ fontSize: '11px', color: '#475569' }}>{CAT_ICONS[selected.category]||'📁'} {selected.category}</span>
                    {selected.source==='lingxing_auto' && <span style={{ fontSize: '11px', color: '#06b6d4', background: '#06b6d411', padding: '2px 8px', borderRadius: '4px' }}>🤖 领星同步</span>}
                    {selected.source==='manual' && <span style={{ fontSize: '11px', color: '#94a3b8', background: '#ffffff08', padding: '2px 8px', borderRadius: '4px' }}>✋ 手工录入</span>}
                  </div>
                  <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f1f5f9', lineHeight: 1.4 }}>{selected.title}</h2>
                  {selected.due_date && (
                    <div style={{ marginTop: '6px', fontSize: '12px', color: dueCls(selected.due_date) }}>
                      📅 截止 {selected.due_date}{selected.due_date < today ? ' (已逾期)' : selected.due_date === today ? ' (今日到期)' : ''}
                    </div>
                  )}
                  {selected.lingxing_order_no && (
                    <div style={{ marginTop: '4px', fontSize: '11px', color: '#475569' }}>单号：{selected.lingxing_order_no}</div>
                  )}
                  {selected.description && (
                    <div style={{ marginTop: '10px', padding: '10px 12px', background: '#161b26', border: '1px solid #2a3250', borderRadius: '8px', fontSize: '13px', color: '#94a3b8', lineHeight: 1.6 }}>{selected.description}</div>
                  )}
                </div>
                <div style={{ display: 'flex', gap: '8px', flexShrink: 0 }}>
                  <button onClick={()=>setEditing(true)} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #2a3250', background: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>✏️ 编辑</button>
                  <button onClick={()=>deleteTodo(selected.id)} style={{ padding: '7px 14px', borderRadius: '7px', border: '1px solid #ef444433', background: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '12px' }}>🗑</button>
                </div>
              </div>
            </div>

            {/* Status Flow */}
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #1e2535', display: 'flex', gap: '8px', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', color: '#475569', fontWeight: 700, marginRight: '4px' }}>状态流转：</span>
              {[{s:0,l:'待处理',c:'#f97316'},{s:1,l:'进行中',c:'#3b82f6'},{s:2,l:'已完成',c:'#22c55e'},{s:3,l:'已取消',c:'#475569'}].map(({s,l,c})=>(
                <button key={s} onClick={()=>setStatus(selected.id,s)} style={{ padding: '6px 14px', borderRadius: '6px', border: `1px solid ${selected.status===s?c:c+'33'}`, background: selected.status===s?`${c}22`:'transparent', color: selected.status===s?c:'#64748b', fontSize: '12px', fontWeight: selected.status===s?700:400, cursor: 'pointer' }}>{l}</button>
              ))}
            </div>

            {/* Checklist */}
            <div style={{ padding: '20px 24px' }}>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>📋 检查清单</span>
                {(selected.checklist_items?.length??0)>0 && (
                  <span style={{ fontSize: '11px', color: '#22c55e' }}>{selected.checklist_items?.filter(c=>c.is_done).length}/{selected.checklist_items?.length} 完成</span>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {(selected.checklist_items?.length??0)===0 && (
                  <div style={{ padding: '14px', textAlign: 'center', color: '#475569', fontSize: '12px', border: '1px dashed #2a3250', borderRadius: '8px' }}>暂无检查项，在下方添加</div>
                )}
                {selected.checklist_items?.sort((a,b)=>a.sort_order-b.sort_order).map(item=>(
                  <div key={item.id} onClick={()=>toggleCheck(selected.id,item.id,!item.is_done)} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', background: '#161b26', border: `1px solid ${item.is_done?'#22c55e33':'#2a3250'}`, transition: 'border-color 0.15s' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '4px', flexShrink: 0, border: `2px solid ${item.is_done?'#22c55e':'#2a3250'}`, background: item.is_done?'#22c55e':'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px', color: 'white' }}>{item.is_done&&'✓'}</div>
                    <span style={{ fontSize: '13px', color: item.is_done?'#475569':'#e2e8f0', textDecoration: item.is_done?'line-through':'none', flex: 1 }}>{item.content}</span>
                  </div>
                ))}
              </div>
              <AddCheckItem todoId={selected.id} onAdded={reloadSelected} />
            </div>

            {/* Meta */}
            <div style={{ padding: '0 24px 20px', fontSize: '11px', color: '#334155', display: 'flex', gap: '16px' }}>
              <span>创建：{new Date(selected.created_at).toLocaleString('zh-CN')}</span>
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: '12px', color: '#475569' }}>
            <div style={{ fontSize: '48px', opacity: 0.3 }}>📋</div>
            <div style={{ fontSize: '14px' }}>从左侧选择待办查看详情</div>
            <Link href="/wms/todos/new" style={{ fontSize: '13px', color: '#3b82f6', textDecoration: 'none', padding: '8px 16px', border: '1px solid #3b82f644', borderRadius: '7px' }}>+ 新建待办</Link>
          </div>
        )}
      </div>

      {editing && selected && <EditModal todo={selected} onClose={()=>setEditing(false)} onSaved={async()=>{ await reloadSelected(); setEditing(false) }} />}
    </div>
  )
}

export default function TodosPage() {
  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ height: '52px', borderBottom: '1px solid #1e2535', background: '#0d1117', display: 'flex', alignItems: 'center', padding: '0 20px', gap: '12px', flexShrink: 0 }}>
        <span style={{ fontSize: '15px', fontWeight: 700, color: '#f1f5f9' }}>待办计划</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          {['入库作业','出库作业','库存管理','退货处理'].map(c=>(
            <Link key={c} href={`/wms/todos?category=${encodeURIComponent(c)}`} style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '5px', background: '#161b26', border: '1px solid #2a3250', color: '#94a3b8', textDecoration: 'none' }}>{CAT_ICONS[c]} {c}</Link>
          ))}
          <Link href="/wms/todos" style={{ fontSize: '11px', padding: '3px 10px', borderRadius: '5px', background: '#161b26', border: '1px solid #2a3250', color: '#94a3b8', textDecoration: 'none' }}>全部</Link>
        </div>
      </div>
      <Suspense fallback={<div style={{ padding: '40px', textAlign: 'center', color: '#64748b' }}>加载中...</div>}>
        <TodosContent />
      </Suspense>
    </div>
  )
}
