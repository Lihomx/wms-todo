'use client'
import { useState, useEffect } from 'react'

export default function ClientData() {
  const [summary,  setSummary]  = useState<any>(null)
  const [loading,  setLoading]  = useState(true)
  const [customerCode, setCustomerCode] = useState('')

  useEffect(()=>{
    const getCode = () => { try{const s=sessionStorage.getItem('wms_client_session');if(s){const p=JSON.parse(s);if(p.customerCode)return p.customerCode}}catch{} return '' }
    const code = getCode()
    const load = (c:string) => {
      if(!c) return
      setCustomerCode(c)
      fetch(`/api/lingxing/data?type=all&customerCode=${c}`)
        .then(r=>r.json()).then(d=>{ setSummary(d.summary||d); setLoading(false) })
        .catch(()=>setLoading(false))
    }
    if(code) { load(code); return }
    fetch('/api/auth-info').then(r=>r.json()).then(info=>load(info.customerCode||''))
  },[])

  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{marginBottom:'22px'}}>
        <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>OMS 数据总览</h1>
        <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>客户 {customerCode} 的领星系统实时数据</p>
      </div>
      {loading?<div style={{textAlign:'center' as const,padding:'40px',color:'#94a3b8'}}>加载中...</div>
      :!summary?<div style={{...card,padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>数据加载失败，请确认AppKey已正确绑定</div>
      :(
        <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'14px'}}>
          {Object.entries(summary).map(([key,s]:any)=>(
            <div key={key} style={card}>
              <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'8px'}}>{s.label||key}</div>
              <div style={{fontSize:'28px',fontWeight:800,color:s.error?'#dc2626':'#2563eb'}}>{s.error?'!':s.total}</div>
              {s.error&&<div style={{fontSize:'11px',color:'#dc2626',marginTop:'4px'}}>{s.error}</div>}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
