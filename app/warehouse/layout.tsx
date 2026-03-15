'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { group: '工作台', items: [
    { href:'/warehouse/dashboard', icon:'🏠', label:'仓库总览' },
    { href:'/warehouse/todos',     icon:'✅', label:'全部待办' },
  ]},
  { group: '管理', items: [
    { href:'/warehouse/clients',   icon:'👥', label:'客户管理' },
    { href:'/warehouse/staff',     icon:'👤', label:'员工管理' },
  ]},
  { group: '领星数据', items: [
    { href:'/wms/sync',            icon:'⟳',  label:'数据同步' },
    { href:'/wms/oms-data',        icon:'📊', label:'OMS数据总览' },
  ]},
  { group: '系统', items: [
    { href:'/wms/settings',        icon:'⚙️', label:'系统设置' },
  ]},
]

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()

  return (
    <div style={{display:'flex',height:'100vh',background:'#0d1117',color:'#e2e8f0',fontFamily:'system-ui,sans-serif'}}>
      {/* Sidebar */}
      <div style={{width:'196px',flexShrink:0,background:'#161b26',borderRight:'1px solid #2a3250',display:'flex',flexDirection:'column',overflowY:'auto'}}>
        {/* Logo */}
        <div style={{padding:'18px 16px 14px',borderBottom:'1px solid #2a3250'}}>
          <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
            <div style={{width:'32px',height:'32px',borderRadius:'8px',background:'linear-gradient(135deg,#3b82f6,#1d4ed8)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'16px',flexShrink:0}}>🏭</div>
            <div>
              <div style={{fontSize:'13px',fontWeight:800,color:'#f1f5f9',lineHeight:1.2}}>海外仓 WMS</div>
              <div style={{fontSize:'10px',color:'#3b82f6',marginTop:'1px'}}>仓库管理系统</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{flex:1,padding:'10px 8px'}}>
          {NAV.map(group=>(
            <div key={group.group} style={{marginBottom:'8px'}}>
              <div style={{fontSize:'10px',color:'#334155',fontWeight:700,padding:'4px 8px 2px',letterSpacing:'0.05em',textTransform:'uppercase' as const}}>{group.group}</div>
              {group.items.map(item=>{
                const active = path === item.href || (item.href !== '/warehouse/dashboard' && path.startsWith(item.href))
                return (
                  <Link key={item.href} href={item.href} style={{
                    display:'flex',alignItems:'center',gap:'9px',
                    padding:'8px 10px',borderRadius:'7px',marginBottom:'1px',
                    textDecoration:'none',
                    background: active ? '#1e3a5f' : 'transparent',
                    color: active ? '#60a5fa' : '#64748b',
                    fontSize:'13px',fontWeight: active ? 600 : 400,
                    transition:'all 0.12s',
                  }}>
                    <span style={{fontSize:'14px',width:'16px',textAlign:'center' as const}}>{item.icon}</span>
                    <span>{item.label}</span>
                  </Link>
                )
              })}
            </div>
          ))}
        </nav>

        {/* Bottom: OMS client portal link */}
        <div style={{padding:'12px 8px',borderTop:'1px solid #2a3250'}}>
          <div style={{fontSize:'10px',color:'#334155',fontWeight:700,padding:'2px 8px 6px',letterSpacing:'0.05em',textTransform:'uppercase' as const}}>客户端入口</div>
          <Link href="/wms/dashboard" style={{display:'flex',alignItems:'center',gap:'9px',padding:'8px 10px',borderRadius:'7px',textDecoration:'none',border:'1px solid #2a3250',background:'#0d1117',color:'#475569',fontSize:'12px'}}>
            <span>🔗</span>
            <span>OMS 客户端</span>
          </Link>
        </div>
      </div>

      {/* Main content */}
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {children}
      </div>
    </div>
  )
}
