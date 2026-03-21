'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function ClientDashboard() {
  const [info,  setInfo]  = useState<any>(null)
  const [todos, setTodos] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    const getCode = () => {
      try { const s=sessionStorage.getItem('wms_client_session'); if(s){const p=JSON.parse(s);if(p.customerCode)return p} } catch{}
      return null
    }
    const loadData = async (info: any) => {
      setInfo(info)
      const code = info.customerCode
      if(!code) return
      const tr = await fetch(`/api/todos?pageSize=200&customerCode=${code}`).then(r=>r.json())
      setTodos(tr.todos??[])
      setLoading(false)
    }
    const imp = getCode()
    if(imp) { loadData(imp); return }
    fetch('/api/auth-info').then(r=>r.json()).then(loadData)
  },[])

  const pending  = todos.filter(t=>t.status===0).length
  const inprog   = todos.filter(t=>t.status===1).length
  const done     = todos.filter(t=>t.status===2).length
  const overdue  = todos.filter(t=>t.due_date&&new Date(t.due_date)<new Date()&&t.status!==2).length

  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{marginBottom:'22px'}}>
        <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>
          欢迎，{info?.displayName || info?.customerName || '客户'}
        </h1>
        <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>
          {info?.customerCode} · {info?.customerName} · {new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric'})}
        </p>
      </div>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
        {[
          {label:'全部待办',value:loading?'…':todos.length,color:'#0f172a',bg:'#fff',border:'#e2e8f0'},
          {label:'待处理',  value:loading?'…':pending,      color:'#d97706',bg:'#fffbeb',border:'#fde68a'},
          {label:'进行中',  value:loading?'…':inprog,       color:'#2563eb',bg:'#eff6ff',border:'#bfdbfe'},
          {label:'已逾期',  value:loading?'…':overdue,      color:'#dc2626',bg:'#fef2f2',border:'#fecaca'},
        ].map(s=>(
          <div key={s.label} style={{...card,background:s.bg,borderColor:s.border}}>
            <div style={{fontSize:'28px',fontWeight:800,color:s.color,lineHeight:1}}>{s.value}</div>
            <div style={{fontSize:'12px',color:'#64748b',marginTop:'5px'}}>{s.label}</div>
          </div>
        ))}
      </div>

      {/* Quick links */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'20px'}}>
        {[
          {href:'/client/shipping',label:'📦 创建出库单',desc:'Crear envío al cliente'},
          {href:'/client/todos',   label:'✅ 待办事项',  desc:'查看仓库处理进度'},
          {href:'/client/data',    label:'📊 OMS数据',   desc:'入库/出库/库存查询'},
          {href:'/client/settings',label:'⚙ 系统设置',  desc:'绑定API凭证'},
        ].map(l=>(
          <Link key={l.href} href={l.href} style={{...card,display:'flex',alignItems:'center',gap:'12px',textDecoration:'none',padding:'14px 16px'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'14px',fontWeight:600,color:'#0f172a'}}>{l.label}</div>
              <div style={{fontSize:'12px',color:'#94a3b8',marginTop:'2px'}}>{l.desc}</div>
            </div>
            <span style={{color:'#d1d5db',fontSize:'16px'}}>›</span>
          </Link>
        ))}
      </div>

      {/* Recent todos */}
      <div style={card}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
          <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>最新待办</span>
          <Link href="/client/todos" style={{fontSize:'12px',color:'#2563eb',textDecoration:'none'}}>全部 →</Link>
        </div>
        {loading ? <div style={{color:'#94a3b8',fontSize:'13px'}}>加载中...</div>
        : todos.length===0 ? <div style={{color:'#94a3b8',fontSize:'13px'}}>暂无待办</div>
        : todos.slice(0,6).map(t=>(
          <div key={t.id} style={{display:'flex',alignItems:'center',gap:'10px',padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}>
            <span style={{width:'7px',height:'7px',borderRadius:'50%',flexShrink:0,background:t.status===2?'#22c55e':t.status===1?'#2563eb':'#f97316'}}/>
            <span style={{flex:1,fontSize:'13px',color:'#0f172a',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{t.title}</span>
            <span style={{fontSize:'11px',color:'#94a3b8',flexShrink:0}}>{t.category}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
