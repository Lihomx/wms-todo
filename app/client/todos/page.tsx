'use client'
import { useState, useEffect } from 'react'

const SL=['待处理','进行中','已完成','已取消']
const SC=['#f97316','#3b82f6','#22c55e','#64748b']

export default function ClientTodos() {
  const [todos,    setTodos]    = useState<any[]>([])
  const [selected, setSelected] = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [statusFilter, setStatusFilter] = useState('')

  useEffect(()=>{
    const getCode = () => { try{const s=sessionStorage.getItem('wms_client_session');if(s){const p=JSON.parse(s);if(p.customerCode)return p.customerCode}}catch{} return '' }
    const code = getCode()
    if(!code){ fetch('/api/auth-info').then(r=>r.json()).then(info=>{ if(!info.customerCode) return; const p=new URLSearchParams({pageSize:'200',customerCode:info.customerCode}); if(statusFilter)p.set('status',statusFilter); fetch(`/api/todos?${p}`).then(r=>r.json()).then(d=>{setTodos(d.todos??[]);setLoading(false)}) }); return }
    const p = new URLSearchParams({pageSize:'200',customerCode:code})
    if(statusFilter) p.set('status',statusFilter)
    fetch(`/api/todos?${p}`).then(r=>r.json()).then(d=>{setTodos(d.todos??[]);setLoading(false)})
  },[statusFilter])

  return (
    <div style={{flex:1,display:'flex',overflow:'hidden',background:'#f8fafc'}}>
      {/* List */}
      <div style={{width:'340px',flexShrink:0,borderRight:'1px solid #e2e8f0',background:'#fff',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px',borderBottom:'1px solid #f1f5f9'}}>
          <div style={{fontSize:'14px',fontWeight:700,color:'#0f172a',marginBottom:'8px'}}>待办事项 · {todos.length}</div>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{width:'100%',padding:'7px 10px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',cursor:'pointer',outline:'none'}}>
            <option value="">全部状态</option>
            {SL.map((l,i)=><option key={i} value={i}>{l}</option>)}
          </select>
        </div>
        <div style={{flex:1,overflowY:'auto' as const}}>
          {loading?<div style={{padding:'20px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>加载中...</div>
          :todos.map(t=>(
            <div key={t.id} onClick={()=>setSelected(t)} style={{padding:'12px 14px',borderBottom:'1px solid #f1f5f9',cursor:'pointer',background:selected?.id===t.id?'#eff6ff':'transparent'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'6px',marginBottom:'4px'}}>
                <span style={{fontSize:'13px',color:'#0f172a',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,fontWeight:selected?.id===t.id?600:400}}>{t.title}</span>
                <span style={{padding:'1px 6px',borderRadius:'3px',fontSize:'10px',fontWeight:600,background:`${SC[t.status]}20`,color:SC[t.status],flexShrink:0}}>{SL[t.status]}</span>
              </div>
              <div style={{fontSize:'11px',color:'#94a3b8'}}>{t.category}{t.due_date&&<span style={{marginLeft:'6px',color:new Date(t.due_date)<new Date()&&t.status!==2?'#dc2626':'#94a3b8'}}>· {t.due_date}</span>}</div>
            </div>
          ))}
        </div>
      </div>
      {/* Detail */}
      {selected?(
        <div style={{flex:1,padding:'24px',overflowY:'auto' as const}}>
          <div style={{background:'#fff',borderRadius:'10px',padding:'20px',border:'1px solid #e2e8f0',marginBottom:'14px'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:'10px',marginBottom:'10px'}}>
              <span style={{padding:'3px 10px',borderRadius:'20px',fontSize:'12px',fontWeight:600,background:`${SC[selected.status]}15`,color:SC[selected.status],border:`1px solid ${SC[selected.status]}33`}}>{SL[selected.status]}</span>
              <span style={{padding:'3px 10px',borderRadius:'20px',fontSize:'12px',color:'#64748b',background:'#f1f5f9'}}>{selected.category}</span>
            </div>
            <h2 style={{fontSize:'16px',fontWeight:700,color:'#0f172a',marginBottom:'8px'}}>{selected.title}</h2>
            {selected.description&&<p style={{fontSize:'13px',color:'#64748b',lineHeight:1.7}}>{selected.description}</p>}
          </div>
          <div style={{background:'#fff',borderRadius:'10px',padding:'16px',border:'1px solid #e2e8f0'}}>
            <div style={{fontSize:'12px',color:'#94a3b8'}}>创建时间：{new Date(selected.created_at).toLocaleString('zh-CN')}</div>
            {selected.lingxing_order_no&&<div style={{fontSize:'12px',color:'#94a3b8',marginTop:'4px'}}>领星单号：{selected.lingxing_order_no}</div>}
          </div>
        </div>
      ):(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',flexDirection:'column' as const,color:'#94a3b8',gap:'8px'}}>
          <div style={{fontSize:'32px',opacity:0.3}}>✅</div>
          <div style={{fontSize:'13px'}}>选择左侧待办查看详情</div>
        </div>
      )}
    </div>
  )
}
