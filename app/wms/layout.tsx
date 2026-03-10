'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

const NAV = [
  { group: '工作台', items: [
    { href: '/wms/dashboard', icon: '🏠', label: '首页' },
    { href: '/wms/todos',     icon: '✅', label: '全部待办' },
  ]},
  { group: '仓库作业', items: [
    { href: '/wms/todos?category=%E5%85%A5%E5%BA%93%E4%BD%9C%E4%B8%9A', icon: '📦', label: '入库管理' },
    { href: '/wms/todos?category=%E5%87%BA%E5%BA%93%E4%BD%9C%E4%B8%9A', icon: '🚚', label: '出库管理' },
    { href: '/wms/todos?category=%E5%BA%93%E5%AD%98%E7%AE%A1%E7%90%86', icon: '📊', label: '库存预警' },
    { href: '/wms/todos?category=%E9%80%80%E8%B4%A7%E5%A4%84%E7%90%86', icon: '↩',  label: '退货处理' },
  ]},
  { group: '系统', items: [
    { href: '/wms/settings', icon: '⚙️', label: '系统设置' },
  ]},
]

export default function WmsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [userName, setUserName] = useState('管理员')

  useEffect(() => {
    const supabase = getSupabaseBrowserClient()
    supabase.auth.getUser().then(({ data }) => {
      if (!data.user) { router.push('/auth/login'); return }
      setUserName(data.user.email?.split('@')[0] ?? '管理员')
    })
  }, [router])

  const handleLogout = async () => {
    await getSupabaseBrowserClient().auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div style={{ display: 'flex', height: '100vh', overflow: 'hidden', background: '#0f1117' }}>
      {/* Sidebar */}
      <aside style={{ width: '216px', flexShrink: 0, background: '#161b26', borderRight: '1px solid #2a3250', display: 'flex', flexDirection: 'column' }}>
        {/* Logo */}
        <div style={{ padding: '16px', borderBottom: '1px solid #2a3250' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', background: '#1e3a5f', border: '1px solid #2563eb44', borderRadius: '10px', padding: '8px 12px' }}>
            <div style={{ width: '30px', height: '30px', borderRadius: '8px', background: 'linear-gradient(135deg,#3b82f6,#06b6d4)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px', fontWeight: 700, color: 'white', flexShrink: 0 }}>仓</div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>海外仓 WMS</div>
              <div style={{ fontSize: '10px', color: '#64748b' }}>待办管理系统</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: '10px', overflowY: 'auto' }}>
          {NAV.map(({ group, items }) => (
            <div key={group} style={{ marginBottom: '18px' }}>
              <div style={{ fontSize: '10px', color: '#64748b', fontWeight: 600, letterSpacing: '1.5px', textTransform: 'uppercase', padding: '0 8px', marginBottom: '4px' }}>{group}</div>
              {items.map(({ href, icon, label }) => {
                const active = pathname === href.split('?')[0] || pathname.startsWith(href.split('?')[0])
                return (
                  <div key={label} onClick={() => router.push(href)} style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '9px 12px', borderRadius: '8px', cursor: 'pointer', fontSize: '13px', marginBottom: '2px', background: active ? '#1e40af22' : 'transparent', color: active ? '#3b82f6' : '#94a3b8', borderLeft: `2px solid ${active ? '#3b82f6' : 'transparent'}` }}>
                    <span style={{ fontSize: '15px', width: '20px', textAlign: 'center' as const }}>{icon}</span>
                    {label}
                  </div>
                )
              })}
            </div>
          ))}
        </nav>

        {/* User footer */}
        <div style={{ padding: '12px 16px', borderTop: '1px solid #2a3250', display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: 'linear-gradient(135deg,#3b82f6,#8b5cf6)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '13px', fontWeight: 700, color: 'white', flexShrink: 0 }}>
            {userName[0]?.toUpperCase() ?? 'U'}
          </div>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <div style={{ fontSize: '13px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{userName}</div>
            <div style={{ fontSize: '11px', color: '#64748b' }}>仓库管理员</div>
          </div>
          <button onClick={handleLogout} title="退出" style={{ background: 'none', border: 'none', color: '#64748b', cursor: 'pointer', fontSize: '16px' }}>↩</button>
        </div>
      </aside>

      <main style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>{children}</main>
    </div>
  )
}
