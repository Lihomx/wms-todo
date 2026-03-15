'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function WarehouseDashboard() {
  const [todos,   setTodos]   = useState<any[]>([])
  const [clients, setClients] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    Promise.all([
      fetch('/api/todos?pageSize=200').then(r=>r.json()),
      fetch('/api/oms-clients').then(r=>r.json()),
    ]).then(([td,cd])=>{
      setTodos(td.todos??[]); setClients(cd.clients??[]); setLoading(false)
    })
  },[])

  const pending = todos.filter(t=>t.status===0).length
  const done    = todos.filter(t=>t.status===2).length
  const overdue = todos.filter(t=>t.due_date&&new Date(t.due_date)<new Date()&&t.status!==2).length

  const clientStats = clients.map(c=>({
    ...c,
    total:   todos.filter(t=>t.customer_code===c.customer_code).length,
    pending: todos.filter(t=>t.customer_code===c.customer_code&&t.status===0).length,
  }))

  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{marginBottom:'22px'}}>
        <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>仓库总览</h1>
        <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</p>
      </div>

      {/* Stats row */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
        {[
          {label:'全部待办',  value:loading?'…':todos.length, color:'#0f172a', bg:'#fff',      border:'#e2e8f0'},
          {label:'待处理',    value:loading?'…':pending,       color:'#d97706', bg:'#fffbeb',   border:'#fde68a'},
          {label:'已完成',    value:loading?'…':done,          color:'#16a34a', bg:'#f0fdf4',   border:'#bbf7d0'},
          {label:'已逾期',    value:loading?'…':overdue,       color:'#dc2626', bg:'#fef2f2',   border:'#fecaca'},
        ].map(s=>(
          <div key={s.label} style={{...card,background:s.bg,borderColor:s.border,padding:'16px'}}>
            <div style={{fontSize:'28px',fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:'12px',color:'#64748b',marginTop:'5px'}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
        {/* Client breakdown */}
        <div style={{...card,overflow:'hidden'}}>
          <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>各客户待办</span>
            <Link href="/warehouse/clients" style={{fontSize:'12px',color:'#2563eb',textDecoration:'none',fontWeight:500}}>管理 →</Link>
          </div>
          {loading ? <div style={{padding:'24px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>加载中...</div>
          : clientStats.length===0 ? (
            <div style={{padding:'24px',textAlign:'center' as const}}>
              <div style={{color:'#94a3b8',fontSize:'13px',marginBottom:'10px'}}>暂无客户</div>
              <Link href="/warehouse/clients" style={{padding:'7px 14px',borderRadius:'6px',background:'#2563eb',color:'white',textDecoration:'none',fontSize:'12px',fontWeight:600}}>添加客户</Link>
            </div>
          ) : (
            <table style={{width:'100%',borderCollapse:'collapse' as const}}>
              <thead><tr style={{background:'#f8fafc'}}>
                {['客户','总待办','待处理','操作'].map(h=><th key={h} style={{padding:'9px 16px',fontSize:'11px',color:'#94a3b8',fontWeight:600,textAlign:'left' as const,borderBottom:'1px solid #f1f5f9'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {clientStats.map((c,i)=>(
                  <tr key={c.customer_code} style={{borderBottom:i<clientStats.length-1?'1px solid #f8fafc':'none'}}>
                    <td style={{padding:'11px 16px'}}>
                      <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>{c.customer_name}</div>
                      <div style={{fontSize:'11px',color:'#94a3b8'}}>{c.customer_code}</div>
                    </td>
                    <td style={{padding:'11px 16px',fontSize:'14px',fontWeight:600,color:'#475569'}}>{c.total}</td>
                    <td style={{padding:'11px 16px'}}><span style={{fontSize:'14px',fontWeight:700,color:'#d97706'}}>{c.pending}</span></td>
                    <td style={{padding:'11px 16px'}}>
                      <Link href={`/warehouse/todos?client=${c.customer_code}`} style={{fontSize:'11px',color:'#2563eb',textDecoration:'none',padding:'4px 8px',borderRadius:'5px',background:'#eff6ff',border:'1px solid #bfdbfe',fontWeight:500}}>查看</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick actions */}
        <div style={{display:'flex',flexDirection:'column' as const,gap:'10px'}}>
          {[
            {href:'/warehouse/todos',   icon:'✅', label:'全部待办', desc:'指派、留言、状态管理',       color:'#2563eb'},
            {href:'/warehouse/clients', icon:'👥', label:'客户管理', desc:'绑定AppKey、同步客户数据',  color:'#7c3aed'},
            {href:'/warehouse/staff',   icon:'👤', label:'员工管理', desc:'账号创建、权限设置',         color:'#0891b2'},
            {href:'/warehouse/sync',    icon:'⟳',  label:'数据同步', desc:'从OMS同步最新单据',         color:'#059669'},
          ].map(l=>(
            <Link key={l.href} href={l.href} style={{...card,display:'flex',alignItems:'center',gap:'12px',padding:'14px 16px',textDecoration:'none',transition:'box-shadow 0.15s'}}>
              <div style={{width:'36px',height:'36px',borderRadius:'8px',background:`${l.color}15`,display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px',flexShrink:0}}>{l.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>{l.label}</div>
                <div style={{fontSize:'12px',color:'#94a3b8',marginTop:'1px'}}>{l.desc}</div>
              </div>
              <span style={{color:'#d1d5db',fontSize:'16px'}}>›</span>
            </Link>
          ))}
        </div>
      </div>
    </div>
  )
}
