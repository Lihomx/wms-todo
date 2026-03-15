'use client'
import { useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

function DashboardContent() {
  const searchParams = useSearchParams()
  const clientCode   = searchParams.get('client') ?? ''
  const [todos, setTodos] = useState<any[]>([])
  const [clientName, setClientName] = useState('')

  useEffect(()=>{
    const params = new URLSearchParams({pageSize:'200'})
    if(clientCode) params.set('customerCode', clientCode)
    fetch(`/api/todos?${params}`).then(r=>r.json()).then(d=>setTodos(d.todos??[]))

    if(clientCode) {
      fetch('/api/oms-clients').then(r=>r.json()).then(d=>{
        const client = d.clients?.find((c:any)=>c.customer_code===clientCode)
        if(client) setClientName(client.customer_name)
      })
    }
  },[clientCode])

  const pending = todos.filter(t=>t.status===0).length
  const inprog  = todos.filter(t=>t.status===1).length
  const done    = todos.filter(t=>t.status===2).length
  const overdue = todos.filter(t=>t.due_date&&new Date(t.due_date)<new Date()&&t.status!==2).length

  const card: React.CSSProperties = {background:'#fff',borderRadius:'10px',border:'1px solid #e2e8f0',padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{marginBottom:'24px'}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>
            {clientName ? `${clientName} - 待办总览` : '待办总览'}
          </h1>
          {clientCode && <span style={{padding:'3px 10px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'12px',fontWeight:600,border:'1px solid #bfdbfe'}}>{clientCode}</span>}
        </div>
        <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</p>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'24px'}}>
        {[
          {label:'全部待办',value:todos.length,  color:'#0f172a', bg:'#f8fafc',  border:'#e2e8f0'},
          {label:'待处理',  value:pending,        color:'#d97706', bg:'#fffbeb',  border:'#fde68a'},
          {label:'进行中',  value:inprog,         color:'#2563eb', bg:'#eff6ff',  border:'#bfdbfe'},
          {label:'已完成',  value:done,           color:'#16a34a', bg:'#f0fdf4',  border:'#bbf7d0'},
        ].map(s=>(
          <div key={s.label} style={{...card,background:s.bg,borderColor:s.border}}>
            <div style={{fontSize:'26px',fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:'12px',color:'#64748b',marginTop:'5px'}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Recent todos */}
      <div style={card}>
        <div style={{fontSize:'14px',fontWeight:600,color:'#0f172a',marginBottom:'14px'}}>最新待办</div>
        {todos.length===0 ? (
          <div style={{textAlign:'center' as const,padding:'30px',color:'#94a3b8',fontSize:'13px'}}>暂无待办</div>
        ) : todos.slice(0,10).map(t=>(
          <div key={t.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'10px 0',borderBottom:'1px solid #f1f5f9'}}>
            <span style={{width:'7px',height:'7px',borderRadius:'50%',background:t.status===2?'#16a34a':t.status===1?'#2563eb':'#d97706',flexShrink:0}}/>
            <span style={{flex:1,fontSize:'13px',color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{t.title}</span>
            <span style={{fontSize:'11px',color:'#94a3b8',flexShrink:0}}>{t.category}</span>
            {t.due_date && <span style={{fontSize:'11px',color:new Date(t.due_date)<new Date()&&t.status!==2?'#dc2626':'#94a3b8',flexShrink:0}}>{t.due_date}</span>}
          </div>
        ))}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return <Suspense fallback={<div style={{padding:'40px',textAlign:'center' as const,color:'#94a3b8',background:'#f8fafc',flex:1}}>加载中...</div>}><DashboardContent/></Suspense>
}
