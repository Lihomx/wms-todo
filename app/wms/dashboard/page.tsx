'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

interface Todo { id: string; status: number; priority: number; due_date?: string; category: string; title: string; created_at: string; source: string }

const CATS = [
  { key: '入库作业', label: '入库管理', icon: '📦', color: '#3b82f6', desc: '入库预报 · 收货上架' },
  { key: '出库作业', label: '出库管理', icon: '🚚', color: '#f97316', desc: '一件代发 · FBA备货' },
  { key: '库存管理', label: '库存预警', icon: '📊', color: '#a855f7', desc: '滞销预警 · 库存异常' },
  { key: '退货处理', label: '退货处理', icon: '↩️', color: '#ef4444', desc: '退件处理 · 质检入库' },
  { key: '工单审批', label: '工单审批', icon: '📋', color: '#22c55e', desc: '操作申请 · 异常审批' },
  { key: '其他',     label: '其他事项', icon: '⚡', color: '#eab308', desc: '临时任务 · 杂项待办' },
]

export default function DashboardPage() {
  const [todos, setTodos]   = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/todos?pageSize=500')
      .then(r => r.json())
      .then(d => { setTodos(d.todos ?? []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const active   = todos.filter(t => t.status !== 2 && t.status !== 3)
  const today    = new Date().toISOString().split('T')[0]
  const overdue  = active.filter(t => t.due_date && t.due_date < today)
  const dueToday = active.filter(t => t.due_date === today)
  const urgent   = active.filter(t => t.priority === 1)
  const done     = todos.filter(t => t.status === 2)

  const catStats = CATS.map(c => {
    const catTodos = todos.filter(t => t.category === c.key)
    const catActive = catTodos.filter(t => t.status !== 2 && t.status !== 3)
    const catUrgent = catActive.filter(t => t.priority === 1)
    const catOverdue = catActive.filter(t => t.due_date && t.due_date < today)
    return { ...c, total: catActive.length, urgent: catUrgent.length, overdue: catOverdue.length, done: catTodos.filter(t=>t.status===2).length }
  })

  const recentTodos = [...todos].filter(t=>t.status!==2).sort((a,b)=>new Date(b.created_at).getTime()-new Date(a.created_at).getTime()).slice(0,8)

  const statCards = [
    { label: '进行中待办', value: active.length,    color: '#3b82f6', bg: '#1e3a5f', icon: '▶' },
    { label: '已逾期',     value: overdue.length,   color: '#ef4444', bg: '#4a1919', icon: '⚠' },
    { label: '今日到期',   value: dueToday.length,  color: '#f97316', bg: '#4a2a10', icon: '📅' },
    { label: '紧急任务',   value: urgent.length,    color: '#a855f7', bg: '#35174e', icon: '🔴' },
    { label: '今日完成',   value: done.filter(t=>t.due_date===today||new Date(t.created_at).toISOString().split('T')[0]===today).length, color: '#22c55e', bg: '#14391f', icon: '✓' },
    { label: '总待办数',   value: todos.length,     color: '#94a3b8', bg: '#1e2535', icon: '≡' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#0d1117' }}>
      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '28px' }}>
          <div>
            <h1 style={{ fontSize: '22px', fontWeight: 800, color: '#f1f5f9', letterSpacing: '-0.3px' }}>仓储作业中心</h1>
            <p style={{ fontSize: '13px', color: '#475569', marginTop: '4px' }}>{today} · {loading ? '加载中...' : `共 ${todos.length} 条待办`}</p>
          </div>
          <Link href="/wms/todos/new" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '9px 18px', borderRadius: '8px', background: '#3b82f6', color: 'white', fontWeight: 700, fontSize: '13px', textDecoration: 'none', boxShadow: '0 0 16px #3b82f644' }}>
            + 新建待办
          </Link>
        </div>

        {/* Stat Cards */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '12px', marginBottom: '28px' }}>
          {statCards.map(s => (
            <div key={s.label} style={{ background: s.bg, border: `1px solid ${s.color}22`, borderRadius: '10px', padding: '16px 14px' }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.color, lineHeight: 1 }}>{loading ? '—' : s.value}</div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '6px', fontWeight: 600 }}>{s.label}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: '20px' }}>
          {/* Category Kanban */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}>业务分类看板</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '12px' }}>
              {catStats.map(c => (
                <Link key={c.key} href={`/wms/todos?category=${encodeURIComponent(c.key)}`} style={{ textDecoration: 'none' }}>
                  <div style={{ background: '#161b26', border: `1px solid ${c.total > 0 ? c.color+'33' : '#2a3250'}`, borderRadius: '12px', padding: '18px', cursor: 'pointer', transition: 'border-color 0.2s' }}
                    onMouseEnter={e=>(e.currentTarget.style.borderColor=c.color+'66')}
                    onMouseLeave={e=>(e.currentTarget.style.borderColor=c.total>0?c.color+'33':'#2a3250')}>
                    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '12px' }}>
                      <div>
                        <div style={{ fontSize: '20px', marginBottom: '6px' }}>{c.icon}</div>
                        <div style={{ fontSize: '13px', fontWeight: 700, color: '#e2e8f0' }}>{c.label}</div>
                        <div style={{ fontSize: '11px', color: '#475569', marginTop: '2px' }}>{c.desc}</div>
                      </div>
                      <div style={{ fontSize: '28px', fontWeight: 800, color: c.total > 0 ? c.color : '#2a3250', lineHeight: 1 }}>{c.total}</div>
                    </div>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      {c.overdue > 0 && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#ef444422', color: '#ef4444', fontWeight: 600 }}>逾期 {c.overdue}</span>}
                      {c.urgent  > 0 && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#a855f722', color: '#a855f7', fontWeight: 600 }}>紧急 {c.urgent}</span>}
                      {c.done    > 0 && <span style={{ fontSize: '11px', padding: '2px 8px', borderRadius: '4px', background: '#22c55e22', color: '#22c55e', fontWeight: 600 }}>完成 {c.done}</span>}
                      {c.total === 0 && <span style={{ fontSize: '11px', color: '#475569' }}>暂无待办</span>}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Todos */}
          <div>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#64748b', marginBottom: '14px', letterSpacing: '1px', textTransform: 'uppercase' }}>最新待办</div>
            <div style={{ background: '#161b26', border: '1px solid #2a3250', borderRadius: '12px', overflow: 'hidden' }}>
              {loading ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>加载中...</div>
              ) : recentTodos.length === 0 ? (
                <div style={{ padding: '40px', textAlign: 'center', color: '#475569' }}>
                  <div style={{ fontSize: '28px', marginBottom: '8px' }}>✅</div>
                  <div style={{ fontSize: '13px' }}>暂无进行中待办</div>
                  <Link href="/wms/todos/new" style={{ display: 'inline-block', marginTop: '12px', fontSize: '12px', color: '#3b82f6', textDecoration: 'none' }}>+ 新建第一个待办</Link>
                </div>
              ) : recentTodos.map((t, i) => {
                const priColor = t.priority === 1 ? '#ef4444' : t.priority === 2 ? '#3b82f6' : '#64748b'
                const isOverdue = t.due_date && t.due_date < today
                return (
                  <Link key={t.id} href={`/wms/todos?id=${t.id}`} style={{ textDecoration: 'none' }}>
                    <div style={{ padding: '12px 14px', borderBottom: i < recentTodos.length-1 ? '1px solid #1e2535' : 'none', display: 'flex', gap: '10px', alignItems: 'flex-start' }}
                      onMouseEnter={e=>(e.currentTarget.style.background='#1c2333')}
                      onMouseLeave={e=>(e.currentTarget.style.background='transparent')}>
                      <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: priColor, marginTop: '6px', flexShrink: 0 }} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: '12px', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                        <div style={{ display: 'flex', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                          <span style={{ fontSize: '10px', color: '#475569' }}>{t.category}</span>
                          {isOverdue && <span style={{ fontSize: '10px', color: '#ef4444', fontWeight: 600 }}>逾期</span>}
                          {t.due_date && <span style={{ fontSize: '10px', color: isOverdue ? '#ef4444' : '#475569' }}>{t.due_date}</span>}
                          {t.source === 'lingxing_auto' && <span style={{ fontSize: '10px', color: '#06b6d4' }}>领星</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                )
              })}
              {todos.filter(t=>t.status!==2).length > 8 && (
                <Link href="/wms/todos" style={{ display: 'block', textAlign: 'center', padding: '12px', fontSize: '12px', color: '#3b82f6', textDecoration: 'none', borderTop: '1px solid #1e2535' }}>
                  查看全部 {todos.filter(t=>t.status!==2).length} 条 →
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
