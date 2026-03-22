'use client'
import { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'

function getSession() {
  if(typeof window==='undefined') return null
  try { const s=sessionStorage.getItem('jt_client_session'); return s?JSON.parse(s):null } catch { return null }
}

const NAV = [
  { href:'/jt/new',    icon:'📝', label:'Crear guía / 创建面单' },
  { href:'/jt/orders', icon:'📋', label:'Mis guías / 我的订单' },
]

export default function JTClientLayout({ children }: { children: React.ReactNode }) {
  const router  = useRouter()
  const path    = usePathname()
  const [sess,  setSess]  = useState<any>(null)
  const [ready, setReady] = useState(false)

  useEffect(() => {
    const s = getSession()
    if (!s?.token) { router.replace('/jt/login'); return }
    setSess(s); setReady(true)
  }, [router])

  if (!ready) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f5f4f0',color:'#6b6560'}}>Cargando...</div>

  const logout = () => { sessionStorage.removeItem('jt_client_session'); router.replace('/jt/login') }

  return (
    <div style={{minHeight:'100vh',display:'flex',flexDirection:'column' as const,fontFamily:"'DM Sans',system-ui,sans-serif",background:'#f5f4f0'}}>
      {/* Topbar */}
      <div style={{background:'#fff',borderBottom:'1px solid #e0dbd2',height:'56px',display:'flex',alignItems:'center',justifyContent:'space-between',padding:'0 24px',position:'sticky' as const,top:0,zIndex:100}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',fontWeight:700,fontSize:'16px'}}>
          <div style={{width:'28px',height:'28px',background:'#e85d2f',borderRadius:'6px',display:'flex',alignItems:'center',justifyContent:'center',color:'#fff',fontSize:'13px',fontWeight:800}}>JT</div>
          极兔打单系统
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'16px',fontSize:'13px',color:'#6b6560'}}>
          <span style={{display:'flex',alignItems:'center',gap:'6px'}}>
            <span style={{width:'28px',height:'28px',borderRadius:'50%',background:'#e85d2f',color:'#fff',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',fontWeight:700}}>{(sess?.name||'U')[0].toUpperCase()}</span>
            {sess?.name}
          </span>
          <button onClick={logout} style={{background:'none',border:'1px solid #e0dbd2',borderRadius:'6px',padding:'5px 12px',cursor:'pointer',fontSize:'13px',color:'#6b6560'}}>Salir</button>
        </div>
      </div>
      <div style={{display:'flex',flex:1}}>
        {/* Sidebar */}
        <div style={{width:'220px',background:'#fff',borderRight:'1px solid #e0dbd2',padding:'16px 0',flexShrink:0}}>
          {NAV.map(item=>{
            const active = path.startsWith(item.href)
            return (
              <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 20px',fontSize:'13.5px',fontWeight:500,textDecoration:'none',color:active?'#e85d2f':'#6b6560',background:active?'#fff2ee':'transparent',borderLeft:`3px solid ${active?'#e85d2f':'transparent'}`}}>
                <span style={{fontSize:'16px'}}>{item.icon}</span>{item.label}
              </Link>
            )
          })}
        </div>
        <div style={{flex:1,padding:'24px',overflowY:'auto' as const}}>{children}</div>
      </div>
    </div>
  )
}
