'use client'
import { useEffect, useState } from 'react'

export default function DashboardPage() {
  const [total,  setTotal]  = useState(0)
  const [urgent, setUrgent] = useState(0)
  const [dueToday, setDueToday] = useState(0)
  const [done,   setDone]   = useState(0)
  const [syncing,  setSyncing]  = useState(false)
  const [syncMsg,  setSyncMsg]  = useState('')

  useEffect(() => {
    fetch('/api/todos?pageSize=500')
      .then(r => r.json())
      .then(data => {
        const todos: Array<{ status: number; priority: number; due_date?: string }> = data.todos ?? []
        const todayStr = new Date().toISOString().split('T')[0]
        setTotal(todos.filter(t => t.status !== 2).length)
        setUrgent(todos.filter(t => t.priority === 1 && t.status !== 2).length)
        setDueToday(todos.filter(t => t.due_date === todayStr && t.status !== 2).length)
        setDone(todos.filter(t => t.status === 2).length)
      })
      .catch(() => {})
  }, [])

  const handleSync = async () => {
    setSyncing(true); setSyncMsg('')
    try {
      const res  = await fetch('/api/lingxing/sync', { method: 'POST' })
      const data = await res.json()
      setSyncMsg(data.success ? `✅ ${data.message}` : `❌ ${data.error}`)
    } catch {
      setSyncMsg('❌ 同步失败')
    } finally {
      setSyncing(false)
    }
  }

  const cards = [
    { label: '全部待办', value: total,    color: '#3b82f6', icon: '≡' },
    { label: '紧急待办', value: urgent,   color: '#ef4444', icon: '!' },
    { label: '今日到期', value: dueToday, color: '#f97316', icon: '📅' },
    { label: '已完成',   value: done,     color: '#22c55e', icon: '✓' },
  ]

  const shortcuts = [
    { label: '入库管理', icon: '📦', href: '/wms/todos?category=%E5%85%A5%E5%BA%93%E4%BD%9C%E4%B8%9A' },
    { label: '出库管理', icon: '🚚', href: '/wms/todos?category=%E5%87%BA%E5%BA%93%E4%BD%9C%E4%B8%9A' },
    { label: '库存预警', icon: '📊', href: '/wms/todos?category=%E5%BA%93%E5%AD%98%E7%AE%A1%E7%90%86' },
    { label: '退货处理', icon: '↩',  href: '/wms/todos?category=%E9%80%80%E8%B4%A7%E5%A4%84%E7%90%86' },
    { label: '系统设置', icon: '⚙️', href: '/wms/settings' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '28px 32px' }}>
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: '28px' }}>
        <div>
          <h1 style={{ fontSize: '20px', fontWeight: 700, marginBottom: '4px' }}>仓库工作台</h1>
          <div style={{ fontSize: '13px', color: '#64748b' }}>{new Date().toLocaleDateString('zh-CN', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'long' })}</div>
        </div>
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '12px' }}>
          {syncMsg && <span style={{ fontSize: '12px', color: syncMsg.startsWith('✅') ? '#22c55e' : '#ef4444' }}>{syncMsg}</span>}
          <button onClick={handleSync} disabled={syncing} style={{ padding: '8px 18px', borderRadius: '8px', border: 'none', background: syncing ? '#1e293b' : 'linear-gradient(135deg,#3b82f6,#2563eb)', color: syncing ? '#64748b' : 'white', fontSize: '13px', fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer' }}>
            {syncing ? '⏳ 同步中...' : '🔄 立即同步'}
          </button>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '16px', marginBottom: '28px' }}>
        {cards.map(({ label, value, color, icon }) => (
          <div key={label} style={{ background: '#1c2333', border: '1px solid #2a3250', borderRadius: '12px', padding: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '10px', background: `${color}22`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px', color }}>{icon}</div>
              <span style={{ fontSize: '13px', color: '#94a3b8' }}>{label}</span>
            </div>
            <div style={{ fontSize: '32px', fontWeight: 700, color, fontFamily: 'monospace' }}>{value}</div>
          </div>
        ))}
      </div>

      <h2 style={{ fontSize: '14px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px' }}>快速入口</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '12px' }}>
        {shortcuts.map(({ label, icon, href }) => (
          <a key={label} href={href} style={{ background: '#1c2333', border: '1px solid #2a3250', borderRadius: '12px', padding: '18px 16px', display: 'block', transition: 'border-color .2s' }}
            onMouseEnter={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#3b82f6' }}
            onMouseLeave={e => { (e.currentTarget as HTMLAnchorElement).style.borderColor = '#2a3250' }}>
            <div style={{ fontSize: '28px', marginBottom: '10px' }}>{icon}</div>
            <div style={{ fontSize: '13px', fontWeight: 700 }}>{label}</div>
          </a>
        ))}
      </div>
    </div>
  )
}
