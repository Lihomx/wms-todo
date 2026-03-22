'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

function getAdminSession() {
  if(typeof window==='undefined') return null
  try { return JSON.parse(sessionStorage.getItem('jt_admin_session')||'null') } catch { return null }
}

const NAV = [
  { href:'/jt-admin/orders',   icon:'📋', label:'Órdenes / 订单管理' },
  { href:'/jt-admin/clients',  icon:'👥', label:'Clientes / 客户管理' },
  { href:'/jt-admin/settings', icon:'⚙',  label:'Configuración / 设置' },
]

export default function JTAdminLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  const path    = usePathname()
  const [ready, setReady] = useState(false)
  const [sess,  setSess]  = useState<any>(null)

  useEffect(() => {
    const s = getAdminSession()
    if (!s?.token || s.role !== 'admin') { router.replace('/jt-admin/login'); return }
    setSess(s); setReady(true)
  }, [router])

  if (!ready) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f0f4ff',color:'#6b6560'}}>Cargando...</div>

  const logout = () => { sessionStorage.removeItem('jt_admin_session'); router.replace('/jt-admin/login') }

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column' as const,fontFamily:"'DM Sans',system-ui,sans-serif",background:'#f0f4ff'}}>
      <div style={{background:'#2a4480',height:'56px',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',position:'sticky' as const,top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',fontWeight:700,fontSize:'16px',color:'#fff'}}>
          <div style={{width:'28px',height:'28px',background:'rgba(255,255,255,.2)',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'14px'}}>⚙</div>
          极兔打单 · 管理后台
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'16px',fontSize:'13px',color:'rgba(255,255,255,.8)'}}>
          <span>{sess?.username}</span>
          <button onClick={logout} style={{background:'rgba(255,255,255,.15)',border:'1px solid rgba(255,255,255,.25)',borderRadius:'6px',padding:'5px 12px',cursor:'pointer',fontSize:'13px',color:'#fff'}}>退出</button>
        </div>
      </div>
      <div style={{display:'flex',flex:1}}>
        <div style={{width:'220px',background:'#fff',borderRight:'1px solid #dde3f5',padding:'16px 0',flexShrink:0}}>
          {NAV.map(item=>{
            const active = path.startsWith(item.href)
            return <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 20px',fontSize:'13.5px',fontWeight:500,textDecoration:'none',color:active?'#2a4480':'#6b6560',background:active?'#eef2ff':'transparent',borderLeft:`3px solid ${active?'#2a4480':'transparent'}`}}>
              <span style={{fontSize:'16px'}}>{item.icon}</span>{item.label}
            </Link>
          })}
        </div>
        <div style={{flex:1,padding:'24px',overflowY:'auto' as const}}>{children}</div>
      </div>
    </div>
  )
}
