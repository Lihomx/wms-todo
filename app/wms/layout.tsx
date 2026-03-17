'use client'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
import Link from 'next/link'

const NAV = [
  { group: '工作台', items: [
    { href: '/wms/dashboard', icon: '⊞', label: '首页' },
    { href: '/wms/todos',     icon: '✓', label: '全部待办' },
  ]},
  { group: '打单系统', items: [
    { href: '/wms/shipping', icon: '📦', label: 'Crear envío' },
  ]},
  { group: '领星数据', items: [
    { href: '/wms/oms-data',  icon: '◈', label: 'OMS 数据总览' },
    { href: '/wms/sync',      icon: '↻', label: '数据同步' },
  ]},
  { group: '系统', items: [
    { href: '/wms/settings',  icon: '⚙', label: '系统设置' },
  ]},
]

export default function WmsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router   = useRouter()
  const [user, setUser] = useState<any>(null)
  const [customerCode, setCustomerCode] = useState('')

  useEffect(()=>{
    fetch('/api/auth-info').then(r=>r.json()).then(info=>{
      if(info.role==='guest'){ router.push('/auth/login'); return }
      if(info.role==='warehouse_admin'){ router.push('/warehouse/dashboard'); return }
      setUser(info)
      setCustomerCode(info.customerCode||'')
    })
  },[router])

  const handleLogout = async () => {
    const supabase = getSupabaseBrowserClient()
    await supabase.auth.signOut()
    router.push('/auth/login')
  }

  return (
    <div style={{display:'flex',height:'100vh',background:'#f8fafc',color:'#0f172a',fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif"}}>
      {/* Sidebar */}
      <div style={{width:'200px',flexShrink:0,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',overflowY:'auto'}}>
        <div style={{padding:'16px',borderBottom:'1px solid #f1f5f9'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'#7c3aed',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'15px',flexShrink:0}}>🔗</div>
            <div>
              <div style={{fontSize:'12px',fontWeight:700,color:'#0f172a',lineHeight:1.2}}>OMS 客户端</div>
              <div style={{fontSize:'10px',color:'#7c3aed',marginTop:'1px',fontWeight:500}}>领星OMS数据视图</div>
            </div>
          </div>
        </div>

        <nav style={{flex:1,padding:'8px'}}>
          {NAV.map(g=>(
            <div key={g.group} style={{marginBottom:'4px'}}>
              <div style={{fontSize:'10px',color:'#94a3b8',fontWeight:600,padding:'8px 8px 3px',letterSpacing:'0.06em',textTransform:'uppercase' as const}}>{g.group}</div>
              {g.items.map(item=>{
                const active = pathname===item.href||(item.href.length>10&&pathname.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'6px',marginBottom:'1px',textDecoration:'none',background:active?'#f5f3ff':'transparent',color:active?'#7c3aed':'#475569',fontSize:'13px',fontWeight:active?600:400,transition:'all 0.1s'}}>
                    <span style={{fontSize:'13px',width:'14px',textAlign:'center' as const,opacity:0.7}}>{item.icon}</span>
                    <span>{item.label}</span>
                    {active && <span style={{marginLeft:'auto',width:'4px',height:'4px',borderRadius:'50%',background:'#7c3aed'}}/>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        <div style={{padding:'10px 8px',borderTop:'1px solid #f1f5f9',display:'flex',flexDirection:'column' as const,gap:'5px'}}>
          <Link href="/warehouse/dashboard" style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'6px',textDecoration:'none',color:'#64748b',fontSize:'12px',background:'#f8fafc',border:'1px solid #e2e8f0'}}>
            <span>🏭</span><span>仓库管理端</span>
          </Link>
          {user && (
            <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'6px',background:'none',border:'none',color:'#94a3b8',fontSize:'12px',cursor:'pointer',textAlign:'left' as const,width:'100%'}}>
              <span>↩</span><span>退出登录</span>
            </button>
          )}
        </div>
      </div>

      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>{children}</div>
    </div>
  )
}
