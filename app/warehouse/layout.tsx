'use client'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useState, useEffect } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

const NAV = [
  { group: '工作台', items: [
    { href:'/warehouse/dashboard', icon:'⊞', label:'仓库总览' },
    { href:'/warehouse/todos',     icon:'✓', label:'全部待办' },
  ]},
  { group: '管理', items: [
    { href:'/warehouse/clients',   icon:'⊙', label:'客户管理' },
    { href:'/warehouse/staff',     icon:'⊛', label:'员工管理' },
  ]},
  { group: '领星数据', items: [
    { href:'/warehouse/sync',      icon:'↻', label:'数据同步' },
    { href:'/warehouse/oms-data',  icon:'◈', label:'数据总览' },
  ]},
  { group: '系统', items: [
    { href:'/warehouse/settings',  icon:'⚙', label:'系统设置' },
  ]},
]

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const path   = usePathname()
  const router = useRouter()
  const [authChecked, setAuthChecked] = useState(false)

  useEffect(() => {
    getSupabaseBrowserClient().auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.push('/auth/login')
      } else {
        setAuthChecked(true)
      }
    })
  }, [router])

  const handleLogout = async () => {
    await getSupabaseBrowserClient().auth.signOut()
    router.push('/auth/login')
  }

  if (!authChecked) {
    return <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#94a3b8', fontSize: '14px' }}>加载中...</div>
  }

  return (
    <div style={{display:'flex',height:'100vh',background:'#f8fafc',color:'#0f172a',fontFamily:"'Segoe UI',system-ui,-apple-system,sans-serif"}}>
      {/* Sidebar */}
      <div style={{width:'200px',flexShrink:0,background:'#fff',borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column',overflowY:'auto'}}>
        {/* Logo */}
        <div style={{padding:'16px',borderBottom:'1px solid #f1f5f9'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'34px',height:'34px',borderRadius:'8px',background:'#2563eb',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0}}>🏭</div>
            <div>
              <div style={{fontSize:'13px',fontWeight:700,color:'#0f172a',lineHeight:1.2}}>海外仓 WMS</div>
              <div style={{fontSize:'10px',color:'#2563eb',marginTop:'1px',fontWeight:500}}>仓库管理系统</div>
            </div>
          </div>
        </div>
        {/* Nav */}
        <nav style={{flex:1,padding:'8px 8px'}}>
          {NAV.map(g=>(
            <div key={g.group} style={{marginBottom:'4px'}}>
              <div style={{fontSize:'10px',color:'#94a3b8',fontWeight:600,padding:'8px 8px 3px',letterSpacing:'0.06em',textTransform:'uppercase' as const}}>{g.group}</div>
              {g.items.map(item=>{
                const active = path===item.href||(item.href.length>20&&path.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href} style={{
                    display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',
                    borderRadius:'6px',marginBottom:'1px',textDecoration:'none',
                    background: active?'#eff6ff':'transparent',
                    color: active?'#2563eb':'#475569',
                    fontSize:'13px',fontWeight:active?600:400,
                    transition:'all 0.1s',
                  }}>
                    <span style={{fontSize:'13px',width:'14px',textAlign:'center' as const,opacity:0.7}}>{item.icon}</span>
                    <span>{item.label}</span>
                    {active && <span style={{marginLeft:'auto',width:'4px',height:'4px',borderRadius:'50%',background:'#2563eb'}}/>}
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>
        {/* Bottom */}
        <div style={{padding:'10px 8px',borderTop:'1px solid #f1f5f9'}}>
          <Link href="/wms/dashboard" style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'6px',textDecoration:'none',color:'#94a3b8',fontSize:'12px',background:'#f8fafc',border:'1px solid #e2e8f0',marginBottom:'5px'}}>
            <span>🔗</span><span>OMS 客户端</span>
          </Link>
          <button onClick={handleLogout} style={{display:'flex',alignItems:'center',gap:'8px',padding:'7px 10px',borderRadius:'6px',background:'none',border:'none',color:'#94a3b8',fontSize:'12px',cursor:'pointer',width:'100%',textAlign:'left' as const}}>
            <span>↩</span><span>退出登录</span>
          </button>
        </div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>{children}</div>
    </div>
  )
}
