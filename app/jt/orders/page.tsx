'use client'
import { useState, useEffect } from 'react'

function getSession() {
  if(typeof window==='undefined') return null
  try { return JSON.parse(sessionStorage.getItem('jt_client_session')||'null') } catch { return null }
}
function api(action:string, body:object={}) {
  const s = getSession()
  return fetch(`/api/jt?action=${action}`, {
    method:'POST', headers:{'Content-Type':'application/json','x-session-token':s?.token||''},
    body:JSON.stringify(body)
  }).then(r=>r.json()).then(d=>{ if(!d.success) throw new Error(d.msg); return d.data })
}

const STATUS_STYLE:Record<string,{label:string;bg:string;color:string}> = {
  reviewing: {label:'审核中',         bg:'#fff7e0',color:'#b45309'},
  pending:   {label:'待同步',         bg:'#fff7e0',color:'#b45309'},
  synced:    {label:'✓ 已同步',       bg:'#e0f5ec',color:'#2a9d5c'},
  sync_error:{label:'⚠ 同步失败',     bg:'#fde8e8',color:'#d63030'},
  deleted:   {label:'已删除',         bg:'#f0e8ff',color:'#6b21a8'},
}

export default function JTClientOrders() {
  const [orders,  setOrders]  = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [tab,     setTab]     = useState('all')

  const load = () => api('get_orders').then(setOrders).catch(()=>{}).finally(()=>setLoading(false))
  useEffect(()=>{ load() },[])

  const filtered = orders.filter(o=>{
    if(tab==='all')    return true
    if(tab==='synced') return o.status==='synced'
    if(tab==='pending')return ['reviewing','pending'].includes(o.status)
    return ['sync_error','deleted'].includes(o.status)
  })

  const tabs=[{k:'all',l:'全部',c:orders.length},{k:'synced',l:'已同步',c:orders.filter(o=>o.status==='synced').length},{k:'pending',l:'待处理',c:orders.filter(o=>['reviewing','pending'].includes(o.status)).length},{k:'error',l:'错误',c:orders.filter(o=>['sync_error','deleted'].includes(o.status)).length}]

  const td:React.CSSProperties={padding:'12px 14px',borderBottom:'1px solid #e0dbd2',fontSize:'13px',verticalAlign:'middle' as const}

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700}}>Mis guías / 我的订单</h1>
          <p style={{fontSize:'13px',color:'#6b6560',marginTop:'3px'}}>Historial de órdenes enviadas</p>
        </div>
        <button onClick={load} style={{padding:'8px 16px',borderRadius:'6px',background:'#f5f4f0',border:'1px solid #e0dbd2',cursor:'pointer',fontSize:'13px',fontWeight:600}}>↻ Actualizar</button>
      </div>
      {/* Tabs */}
      <div style={{display:'flex',gap:'0',borderBottom:'1px solid #e0dbd2',marginBottom:'16px'}}>
        {tabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:'8px 16px',border:'none',borderBottom:`2px solid ${tab===t.k?'#e85d2f':'transparent'}`,background:'none',color:tab===t.k?'#e85d2f':'#6b6560',fontSize:'13px',fontWeight:tab===t.k?600:400,cursor:'pointer'}}>
          {t.l} <span style={{padding:'1px 6px',borderRadius:'10px',background:tab===t.k?'#fff2ee':'#f0ede8',color:tab===t.k?'#e85d2f':'#6b6560',fontSize:'11px',fontWeight:600}}>{t.c}</span>
        </button>)}
      </div>
      <div style={{background:'#fff',border:'1px solid #e0dbd2',borderRadius:'10px',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
          <thead><tr style={{background:'#f0ede8'}}>
            {['Ref / 单号','Destinatario','CP · Colonia','Ciudad','Estado','Tracking','Fecha','Status'].map(h=>(
              <th key={h} style={{padding:'10px 14px',textAlign:'left' as const,fontSize:'11px',fontWeight:700,color:'#6b6560',textTransform:'uppercase' as const,letterSpacing:'0.5px',borderBottom:'1px solid #e0dbd2'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={8} style={{...td,textAlign:'center' as const,color:'#6b6560',padding:'40px'}}>Cargando...</td></tr>
            : filtered.length===0 ? <tr><td colSpan={8} style={{...td,textAlign:'center' as const,color:'#6b6560',padding:'40px'}}>No hay órdenes</td></tr>
            : filtered.map((o,i)=>{
              const d = o.data||{}
              const st = STATUS_STYLE[o.status]||{label:o.status,bg:'#f0ede8',color:'#6b6560'}
              return <tr key={o.id} style={{background:i%2===0?'#fff':'#fafaf8'}}>
                <td style={{...td,fontFamily:'monospace',fontSize:'11px',color:'#2a4480',fontWeight:600}}>{o.reference_no}</td>
                <td style={td}><div style={{fontWeight:500}}>{d.consignee_name||'-'}</div><div style={{fontSize:'11px',color:'#6b6560'}}>{d.consignee_phone}</div></td>
                <td style={{...td,fontSize:'12px'}}>{d.consignee_postcode} · {d.consignee_colonia}</td>
                <td style={{...td,fontSize:'12px'}}>{d.shipping_city}</td>
                <td style={{...td,fontSize:'12px',color:'#6b6560'}}>{d.shipping_state}</td>
                <td style={{...td,fontFamily:'monospace',fontSize:'11px',color:'#2a9d5c'}}>{o.tracking_no||'-'}</td>
                <td style={{...td,fontSize:'11px',color:'#6b6560'}}>{new Date(o.created_at).toLocaleDateString('es-MX',{day:'2-digit',month:'2-digit',year:'2-digit'})}</td>
                <td style={td}><span style={{padding:'3px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:st.bg,color:st.color}}>{st.label}</span></td>
              </tr>
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}
