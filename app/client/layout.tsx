'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

interface AuthInfo { role:string; customerCode:string; customerName:string; displayName:string; email:string; isActive:boolean; isImpersonated?:boolean }

const NAV = [
  { href:'/client/dashboard',  icon:'⊞',  label:'总览',     group:'' },
  { href:'/client/warehouse',  icon:'🏭',  label:'仓库服务', group:'仓储' },
  { href:'/client/inventory',  icon:'📊',  label:'产品库存', group:'仓储' },
  { href:'/client/products',   icon:'🗂',  label:'产品管理', group:'仓储' },
  { href:'/client/shipping',   icon:'📦',  label:'创建出库单(领星)',group:'出库' },
  { href:'/client/jt-new',     icon:'🚚',  label:'极兔打单',    group:'出库' },
  { href:'/client/jt-orders',  icon:'📋',  label:'极兔订单',    group:'出库' },
  { href:'/client/todos',      icon:'✓',   label:'待办事项', group:'工作台' },
  { href:'/client/data',       icon:'◈',   label:'OMS数据',  group:'工作台' },
  { href:'/client/settings',   icon:'⚙',   label:'系统设置', group:'' },
]

export default function ClientLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  const path    = usePathname()
  const [info,  setInfo]  = useState<AuthInfo|null>(null)
  const [ready, setReady] = useState(false)

  useEffect(()=>{
    // Skip auth check for login page itself
    if (path === '/client/login' || path.startsWith('/client/login')) {
      setReady(true)
      return
    }

    // Check sessionStorage for impersonation session (warehouse admin direct access)
    try {
      const raw = sessionStorage.getItem('wms_client_session')
      if (raw) {
        const session = JSON.parse(raw)
        if (session.customerCode) {
          setInfo({ role:'client', ...session })
          setReady(true)
          return
        }
      }
    } catch {}

    // Fall back to Supabase auth (normal client login)
    fetch('/api/auth-info').then(r=>r.json()).then(d=>{
      if (d.role === 'guest') { router.push('/client/login'); return }
      if (d.role === 'warehouse_admin') { router.push('/warehouse/dashboard'); return }
      if (!d.isActive) { router.push('/client/login'); return }
      setInfo(d); setReady(true)
    })
  },[router, path])

  const logout = async()=>{
    // Clear impersonation session
    sessionStorage.removeItem('wms_client_session')
    // Also sign out Supabase if needed
    try { await getSupabaseBrowserClient().auth.signOut() } catch {}
    router.push('/client/login')
  }

  // On login page, render without sidebar
  if (path === '/client/login' || path.startsWith('/client/login')) {
    return <>{children}</>
  }

  if(!ready) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',color:'#94a3b8',fontSize:'14px'}}>加载中...</div>

  return (
    <div style={{display:'flex',height:'100vh',background:'#f8fafc',fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      {/* Sidebar */}
      <div style={{width:'196px',flexShrink:0,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column'}}>
        {/* Logo */}
        <div style={{padding:'16px',borderBottom:'1px solid #f1f5f9'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'34px',height:'34px',borderRadius:'8px',background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0}}>📦</div>
            <div>
              <div style={{fontSize:'12px',fontWeight:700,color:'#0f172a',lineHeight:1.2}}>客户管理系统</div>
              <div style={{fontSize:'10px',color:'#2563eb',marginTop:'1px',fontWeight:500}}>{info?.customerCode} · {info?.customerName}</div>
            </div>
          </div>
          {info?.isImpersonated && (
            <div style={{marginTop:'8px',padding:'4px 8px',borderRadius:'5px',background:'#fffbeb',border:'1px solid #fde68a',fontSize:'10px',color:'#92400e',display:'flex',alignItems:'center',gap:'4px'}}>
              🔑 仓库管理员访问
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{flex:1,padding:'8px',overflowY:'auto' as const}}>
          {(()=>{
            const groups = ['','仓储','出库','工作台']
            return groups.map(g=>{
              const gItems = NAV.filter(n=>n.group===g)
              if(!gItems.length) return null
              return (
                <div key={g} style={{marginBottom:'4px'}}>
                  {g&&<div style={{fontSize:'10px',fontWeight:600,color:'#94a3b8',padding:'6px 10px 2px',textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>{g}</div>}
                  {gItems.map(item=>{
                    const active = path===item.href||(item.href.length>10&&path.startsWith(item.href))
                    return (
                      <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'6px',marginBottom:'1px',textDecoration:'none',background:active?'#eff6ff':'transparent',color:active?'#2563eb':'#475569',fontSize:'13px',fontWeight:active?600:400}}>
                        <span style={{fontSize:'13px',width:'14px',textAlign:'center' as const}}>{item.icon}</span>
                        <span>{item.label}</span>
                        {active&&<span style={{marginLeft:'auto',width:'4px',height:'4px',borderRadius:'50%',background:'#2563eb'}}/>}
                      </Link>
                    )
                  })}
                </div>
              )
            })
          })()}
        </nav>

        {/* User */}
        <div style={{padding:'10px 8px',borderTop:'1px solid #f1f5f9'}}>
          <div style={{padding:'8px 10px',borderRadius:'6px',background:'#f8fafc',marginBottom:'4px'}}>
            <div style={{fontSize:'12px',fontWeight:600,color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{info?.displayName || info?.customerName}</div>
            <div style={{fontSize:'10px',color:'#94a3b8',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{info?.email}</div>
          </div>
          <button onClick={logout} style={{width:'100%',display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'6px',background:'none',border:'none',color:'#94a3b8',fontSize:'12px',cursor:'pointer',textAlign:'left' as const}}>
            <span>↩</span><span>退出登录</span>
          </button>
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>{children}</div>
    </div>
  )
}
