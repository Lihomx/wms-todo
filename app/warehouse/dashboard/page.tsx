'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Client { customer_code:string;customer_name:string;status:string;todo_count?:number }

export default function WarehouseDashboard() {
  const [todos,    setTodos]    = useState<any[]>([])
  const [clients,  setClients]  = useState<Client[]>([])
  const [loading,  setLoading]  = useState(true)

  useEffect(()=>{
    Promise.all([
      fetch('/api/todos?pageSize=200').then(r=>r.json()),
      fetch('/api/oms-clients').then(r=>r.json()),
    ]).then(([td,cd])=>{
      setTodos(td.todos??[]); setClients(cd.clients??[]); setLoading(false)
    })
  },[])

  const pending   = todos.filter(t=>t.status===0).length
  const inprog    = todos.filter(t=>t.status===1).length
  const done      = todos.filter(t=>t.status===2).length
  const overdue   = todos.filter(t=>t.due_date&&new Date(t.due_date)<new Date()&&t.status!==2).length

  // Per-client stats
  const clientStats = clients.map(c=>({
    ...c,
    total:   todos.filter(t=>t.customer_code===c.customer_code).length,
    pending: todos.filter(t=>t.customer_code===c.customer_code&&t.status===0).length,
  }))
  const noClient = todos.filter(t=>!t.customer_code).length

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#0d1117',padding:'28px 24px'}}>
      <div style={{marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px',fontWeight:800,color:'#f1f5f9'}}>🏭 仓库管理总览</h1>
        <p style={{fontSize:'12px',color:'#475569',marginTop:'4px'}}>{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</p>
      </div>

      {/* Global stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(5,1fr)',gap:'12px',marginBottom:'24px'}}>
        {[
          {label:'全部待办', value:todos.length,  color:'#94a3b8', icon:'📋'},
          {label:'待处理',   value:pending,        color:'#f97316', icon:'⏳'},
          {label:'进行中',   value:inprog,         color:'#3b82f6', icon:'🔄'},
          {label:'已完成',   value:done,           color:'#22c55e', icon:'✅'},
          {label:'已逾期',   value:overdue,        color:'#ef4444', icon:'🔴'},
        ].map(s=>(
          <div key={s.label} style={{background:'#161b26',border:`1px solid ${s.color}33`,borderRadius:'10px',padding:'16px'}}>
            <div style={{fontSize:'20px',marginBottom:'6px'}}>{s.icon}</div>
            <div style={{fontSize:'24px',fontWeight:800,color:s.color}}>{loading?'…':s.value}</div>
            <div style={{fontSize:'11px',color:'#64748b',marginTop:'3px'}}>{s.label}</div>
          </div>
        ))}
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'16px'}}>
        {/* Per-client breakdown */}
        <div style={{background:'#161b26',border:'1px solid #2a3250',borderRadius:'12px',overflow:'hidden'}}>
          <div style={{padding:'14px 18px',borderBottom:'1px solid #2a3250',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{fontSize:'13px',fontWeight:700,color:'#f1f5f9'}}>📊 各客户待办统计</span>
            <Link href="/warehouse/clients" style={{fontSize:'11px',color:'#3b82f6',textDecoration:'none'}}>管理客户 →</Link>
          </div>
          {loading?<div style={{padding:'20px',textAlign:'center' as const,color:'#475569',fontSize:'12px'}}>加载中...</div>
          :clientStats.length===0?
            <div style={{padding:'20px',textAlign:'center' as const}}>
              <div style={{color:'#475569',fontSize:'12px',marginBottom:'8px'}}>暂无客户数据</div>
              <button onClick={()=>fetch('/api/oms-clients/sync',{method:'POST'}).then(()=>window.location.reload())} style={{padding:'6px 14px',borderRadius:'6px',background:'#3b82f6',border:'none',color:'white',cursor:'pointer',fontSize:'12px'}}>从OMS同步客户</button>
            </div>
          :(
            <table style={{width:'100%',borderCollapse:'collapse' as const}}>
              <thead><tr style={{background:'#0a0d14'}}>
                {['客户','总待办','待处理','操作'].map(h=><th key={h} style={{padding:'9px 14px',color:'#64748b',fontWeight:700,textAlign:'left' as const,fontSize:'11px'}}>{h}</th>)}
              </tr></thead>
              <tbody>
                {clientStats.map((c,i)=>(
                  <tr key={c.customer_code} style={{borderBottom:'1px solid #1a2035',background:i%2===0?'transparent':'#0d1117'}}>
                    <td style={{padding:'9px 14px'}}>
                      <div style={{fontSize:'12px',fontWeight:600,color:'#f1f5f9'}}>{c.customer_name}</div>
                      <div style={{fontSize:'10px',color:'#64748b'}}>{c.customer_code}</div>
                    </td>
                    <td style={{padding:'9px 14px',color:'#94a3b8',fontSize:'13px',fontWeight:600}}>{c.total}</td>
                    <td style={{padding:'9px 14px'}}>
                      <span style={{color:'#f97316',fontWeight:700,fontSize:'13px'}}>{c.pending}</span>
                    </td>
                    <td style={{padding:'9px 14px'}}>
                      <Link href={`/warehouse/todos?client=${c.customer_code}`} style={{fontSize:'11px',color:'#3b82f6',textDecoration:'none',padding:'3px 8px',borderRadius:'4px',border:'1px solid #3b82f633',background:'#1e3a5f'}}>查看</Link>
                    </td>
                  </tr>
                ))}
                {noClient>0&&(
                  <tr style={{borderBottom:'1px solid #1a2035'}}>
                    <td style={{padding:'9px 14px',fontSize:'12px',color:'#64748b'}}>未分配客户</td>
                    <td style={{padding:'9px 14px',color:'#94a3b8',fontSize:'13px'}}>{noClient}</td>
                    <td colSpan={2}></td>
                  </tr>
                )}
              </tbody>
            </table>
          )}
        </div>

        {/* Quick actions */}
        <div style={{display:'flex',flexDirection:'column' as const,gap:'12px'}}>
          <div style={{background:'#161b26',border:'1px solid #2a3250',borderRadius:'12px',padding:'18px'}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'#f1f5f9',marginBottom:'12px'}}>⚡ 快捷操作</div>
            {[
              {href:'/warehouse/todos',   icon:'✅', label:'管理全部待办',   desc:'指派、留言、状态更新'},
              {href:'/warehouse/clients', icon:'👥', label:'OMS客户管理',   desc:'查看客户、跳转OMS登录'},
              {href:'/warehouse/staff',   icon:'👤', label:'员工账号',      desc:'创建账号、设置权限'},
              {href:'/wms/sync',          icon:'⟳', label:'同步OMS数据',   desc:'拉取最新单据数据'},
            ].map(l=>(
              <Link key={l.href} href={l.href} style={{display:'flex',alignItems:'center',gap:'12px',padding:'10px 12px',borderRadius:'8px',marginBottom:'6px',background:'#1e2535',textDecoration:'none',border:'1px solid #2a3250',transition:'border-color 0.1s'}}>
                <span style={{fontSize:'18px'}}>{l.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontSize:'12px',fontWeight:600,color:'#f1f5f9'}}>{l.label}</div>
                  <div style={{fontSize:'11px',color:'#475569'}}>{l.desc}</div>
                </div>
                <span style={{color:'#475569',fontSize:'14px'}}>›</span>
              </Link>
            ))}
          </div>
          <div style={{background:'#161b26',border:'1px solid #f9731633',borderRadius:'12px',padding:'16px'}}>
            <div style={{fontSize:'12px',fontWeight:700,color:'#f97316',marginBottom:'8px'}}>⏰ 每日提醒</div>
            <div style={{fontSize:'12px',color:'#64748b',marginBottom:'10px'}}>墨西哥时间每天14:00自动发送邮件提醒</div>
            <button onClick={()=>fetch('/api/reminders',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({force:true})}).then(r=>r.json()).then(d=>alert(d.message??d.error))} style={{padding:'6px 14px',borderRadius:'6px',background:'#f97316',border:'none',color:'white',cursor:'pointer',fontSize:'12px',fontWeight:700}}>
              立即发送测试提醒
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
