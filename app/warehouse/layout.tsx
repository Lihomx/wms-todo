'use client'
import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'

const NAV = [
  { href:'/warehouse/dashboard', icon:'🏭', label:'仓库总览' },
  { href:'/warehouse/clients',   icon:'👥', label:'客户管理' },
  { href:'/warehouse/todos',     icon:'✅', label:'全部待办' },
  { href:'/warehouse/staff',     icon:'👤', label:'员工管理' },
]

export default function WarehouseLayout({ children }: { children: React.ReactNode }) {
  const path = usePathname()
  const [lang, setLang] = useState<'zh'|'es'>('zh')

  const L = {
    zh: { title:'海外仓管理端', subtitle:'仓库管理系统', lang:'ES' },
    es: { title:'Gestión de Almacén', subtitle:'Sistema de Gestión', lang:'中' },
  }[lang]

  return (
    <div style={{display:'flex',height:'100vh',background:'#0d1117',color:'#e2e8f0',fontFamily:'system-ui,sans-serif'}}>
      {/* Sidebar */}
      <div style={{width:'200px',flexShrink:0,background:'#161b26',borderRight:'1px solid #2a3250',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'20px 16px',borderBottom:'1px solid #2a3250'}}>
          <div style={{fontSize:'13px',fontWeight:800,color:'#f1f5f9'}}>{L.title}</div>
          <div style={{fontSize:'10px',color:'#3b82f6',marginTop:'2px'}}>{L.subtitle}</div>
        </div>
        <nav style={{flex:1,padding:'12px 8px'}}>
          {NAV.map(n=>(
            <Link key={n.href} href={n.href} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 10px',borderRadius:'7px',marginBottom:'2px',textDecoration:'none',background:path.startsWith(n.href)?'#1e3a5f':'transparent',color:path.startsWith(n.href)?'#3b82f6':'#64748b',fontSize:'13px',fontWeight:path.startsWith(n.href)?700:400,transition:'all 0.15s'}}>
              <span>{n.icon}</span><span>{n.label}</span>
            </Link>
          ))}
        </nav>
        <div style={{padding:'12px 8px',borderTop:'1px solid #2a3250'}}>
          <button onClick={()=>setLang(l=>l==='zh'?'es':'zh')} style={{width:'100%',padding:'8px',borderRadius:'7px',border:'1px solid #2a3250',background:'transparent',color:'#64748b',cursor:'pointer',fontSize:'12px'}}>
            🌐 {L.lang}
          </button>
          <Link href="/wms/dashboard" style={{display:'block',marginTop:'6px',padding:'8px',borderRadius:'7px',border:'1px solid #2a3250',color:'#64748b',textDecoration:'none',fontSize:'12px',textAlign:'center'}}>
            ← OMS视图
          </Link>
        </div>
      </div>
      <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
        {children}
      </div>
    </div>
  )
}
