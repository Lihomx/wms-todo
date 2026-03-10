'use client'
import { useEffect, useState } from 'react'

interface Stats {
  total: number
  urgent: number
  today: number
  done: number
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats>({ total: 0, urgent: 0, today: 0, done: 0 })
  const [syncing, setSyncing] = useState(false)
  const [syncMsg, setSyncMsg] = useState('')

  useEffect(() => {
    fetch('/api/todos?pageSize=200')
      .then(r => r.json())
      .then(data => {
        const todos = data.todos ?? []
        const today = new Date().toISOString().split('T')[0]
        setStats({
          total:  todos.filter((t: { status: number }) => t.status !== 2).length,
          urgent: todos.filter((t: { priority: number; status: number }) => t.priority === 1 && t.status !== 2).length,
          today:  todos.filter((t: { due_date: string; status: number }) => t.due_date === today && t.status !== 2).length,
          done:   todos.filter((t: { status: number }) => t.status === 2).length,
        })
      })
      .catch(() => {})
  }, [])

  const handleSync = async () => {
    setSyncing(true)
    setSyncMsg('')
    try {
      const res = await fetch('/api/lingxing/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.success ? `✅ ${data.message}` : `❌ ${data.error}`)
    } catch {
      setSyncMsg('❌ 同步失败，请检查网络')
    } finally {
      setSyncing(false)
    }
  }

  const cards = [
    { label: '全部待办', value: stats.total, color: '#3b82f6', bg: '#1e40af22', icon: '≡' },
    { label: '紧急待办', value: stats.urgent, color: '#ef4444', bg: '#7f1d1d22', icon: '!' },
    { label: '今日到期', value: stats.today,  color: '#f97316', bg: '#7c2d1222', icon: '📅' },
    { label: '已完成',   value: stats.done,   color: '#22c55e', bg: '#14532d22', icon: '✓' },
  ]

  const categories = [
    { label: '入库管理', icon: '📦', desc: '待入库 / 待上架',  color: '#3b82f6', href: '/wms/todos?category=入库作业' },
    { label: '出库管理', icon: '🚚', desc: '一件代发 / 送仓',  color: '#8b5cf6', href: '/wms/todos?category=出库作业' },
    { label: '库存预警', icon: '📊', desc: 'SKU低于预警值',    color: '#f97316', href: '/wms/todos?category=库存管理' },
    { label: '退货处理', icon: '↩',  desc: '待处理退件单',    color: '#ef4444', href: '/wms/todos?category=退货处理' },
    { label: '工单审批', icon: '📋', desc: '待审核工单',       color: '#06b6d4', href: '/wms/todos?category=工单' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>仓库工作台</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>
            {new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}
          </div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '10px' }}>
          {syncMsg && (
            <span style={{ fontSize: '12px', color: syncMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>
              {syncMsg}
            </span>
          )}
          <button
            onClick={handleSync}
            disabled={syncing}
            style={{
              padding: '8px 18px', borderRadius: '8px', border: 'none',
              background: syncing ? '#1e293b' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
              color: 'white', fontSize: '13px', fontWeight: 600,
              cursor: syncing ? 'not-allowed' : 'pointer',
              boxShadow: syncing ? 'none' : '0 0 14px #3b82f633',
              display: 'flex', alignItems: 'center', gap: '6px',
            }}
          >
            {syncing ? '⏳ 同步中...' : '🔄 立即同步'}
          </button>
        </div>
      </div>

      {/* Stats cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '28px' }}>
        {cards.map(({ label, value, color, bg, icon }) => (
          <div key={label} style={{
            background: '#1c2333', border: '1px solid #2a3250',
            borderRadius: '12px', padding: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{
                width: '36px', height: '36px', borderRadius: '10px',
                background: bg, display: 'flex', alignItems: 'center',
                justifyContent: 'center', fontSize: '18px', color,
              }}>{icon}</div>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>{label}</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color, fontFamily: 'monospace' }}>
              {value}
            </div>
          </div>
        ))}
      </div>

      {/* Category shortcuts */}
      <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px' }}>快速入口</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' }}>
        {categories.map(({ label, icon, desc, color, href }) => (
          <a key={label} href={href} style={{
            background: '#1c2333', border: '1px solid #2a3250',
            borderRadius: '12px', padding: '18px 16px', cursor: 'pointer',
            transition: 'all .2s', display: 'block',
          }}
          onMouseEnter={e => {
            ;(e.currentTarget as HTMLElement).style.borderColor = color
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(-2px)'
          }}
          onMouseLeave={e => {
            ;(e.currentTarget as HTMLElement).style.borderColor = '#2a3250'
            ;(e.currentTarget as HTMLElement).style.transform = 'translateY(0)'
          }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{icon}</div>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '4px' }}>{label}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>{desc}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
