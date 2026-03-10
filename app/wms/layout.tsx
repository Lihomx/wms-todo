'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase'

const NAV = [
  { group: '工作台', items: [
    { href: '/wms/dashboard', icon: '🏠', label: '首页', badge: null },
    { href: '/wms/todos',     icon: '✅', label: '待办计划', badge: 'todos' },
  ]},
  { group: '仓库作业', items: [
    { href: '/wms/todos?category=入库作业', icon: '📦', label: '入库管理', badge: null },
    { href: '/wms/todos?category=出库作业', icon: '🚚', label: '出库管理', badge: null },
    { href: '/wms/todos?category=库存管理', icon: '📊', label: '库存预警', badge: null },
    { href: '/wms/todos?category=退货处理', icon: '↩',  label: '退货处理', badge: null },
  ]},
  { group: '系统', items: [
    { href: '/wms/settings', icon: '⚙️', label: '系统设置', badge: null },
  ]},
]

export default function WmsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const supabase = getSupabaseBrowserClient()
  const [userName, setUserName] = useState('仓库管理员')

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/auth/login'); return }
      setUserName(user.email?.split('@')[0] ?? '管理员')
    })
  }, [supabase, router])

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0f1117' }}>
      {/* Sidebar */}
      <aside style={{
        width: '220px', flexShrink: 0,
        background: '#161b26',
        borderRight: '1px solid #2a3250',
        display: 'flex', flexDirection: 'column',
      }}>
        {/* Logo */}
        <div style={{ padding: '18px 16px 14px', borderBottom: '1px solid #2a3250' }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: '10px',
            background: 'linear-gradient(135deg,#1e3a5f,#1a2f4a)',
            border: '1px solid #2563eb44', borderRadius: '10px', padding: '8px 12px',
          }}>
            <div style={{
              width: '30px', height: '30px', borderRadius: '8px',
              background: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', fontWeight: 700, color: 'white', flexShrink: 0,
            }}>仓</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>海外仓 WMS</div>
              <div style={{ fontSize: '10px', color: '#64748b', fontFamily: 'monospace' }}>待办管理系统</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
          {NAV.map(({ group, items }) => (
            <div key={group} style={{ marginBottom: '18px' }}>
              <div style={{
                fontSize: '10px', color: '#64748b', fontWeight: 600,
                letterSpacing: '1.5px', textTransform: 'uppercase',
                padding: '0 8px', marginBottom: '4px',
              }}>{group}</div>
              {items.map(({ href, icon, label }) => {
                const active = pathname === href || pathname.startsWith(href.split('?')[0] + '/')
                return (
                  <div
                    key={href}
                    onClick={() => router.push(href)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '9px',
                      padding: '9px 12px', borderRadius: '8px', cursor: 'pointer',
                      fontSize: '13px', marginBottom: '2px', transition: 'all .15s',
                      background: active ? 'linear-gradient(90deg,#1e40af22,#1e40af11)' : 'transparent',
                      color: active ? '#3b82f6' : '#94a3b8',
                      borderLeft: active ? '2px solid #3b82f6' : '2px solid transparent',
                    }}
                  >
                    <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' }}>{icon}</span>
                    {label}
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{
          padding: '12px 16px', borderTop: '1px solid #2a3250',
          display: 'flex', alignItems: 'center', gap: '10px',
        }}>
          <div style={{
            width: '32px', height: '32px', borderRadius: '50%', flexShrink: 0,
            background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '13px', fontWeight: 700, color: 'white',
          }}>
            {userName[0]?.toUpperCase()}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '13px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>仓库管理员</div>
          </div>
          <button
            onClick={handleLogout}
            title="退出登录"
            style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}
          >↩</button>
        </div>
      </aside>

      {/* Main */}
      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {children}
      </main>
    </div>
  )
}
