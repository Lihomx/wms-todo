'use client'
import { useState, useEffect } from 'react'


function getWmsHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" }
  if (typeof window === "undefined") return h
  if (sessionStorage.getItem("wms_warehouse_role") === "admin") { h["x-wms-role"] = "admin"; return h }
  try {
    const s = sessionStorage.getItem("wms_client_session")
    if (s) { const p = JSON.parse(s); if (p?.customerCode) { h["x-wms-role"] = "client"; h["x-customer-code"] = p.customerCode; return h } }
  } catch {}
  return h
}
function api(action: string, body: object = {}): Promise<any> {
  return fetch(`/api/jt?action=${action}`, { method: "POST", headers: getWmsHeaders(), body: JSON.stringify(body) })
    .then(r => r.json()).then(d => { if (!d.success) throw new Error(d.msg || "请求失败"); return d.data })
}


const STATUS_STYLE:Record<string,{label:string;bg:string;color:string}> = {
  reviewing:  {label:'审核中',   bg:'#fff7e0',color:'#b45309'},
  pending:    {label:'待同步',   bg:'#fff7e0',color:'#b45309'},
  synced:     {label:'✓ 已同步', bg:'#e0f5ec',color:'#2a9d5c'},
  sync_error: {label:'⚠ 错误',  bg:'#fde8e8',color:'#d63030'},
  deleted:    {label:'已删除',   bg:'#f0e8ff',color:'#6b21a8'},
}

export default function JTAdminOrders() {
  const [orders,   setOrders]   = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [selected, setSelected] = useState<any>(null)
  const [submitting, setSubmitting] = useState<string|null>(null)
  const [tab,      setTab]      = useState('all')
  const [msg,      setMsg]      = useState<{text:string;ok:boolean}|null>(null)

  const load = () => {
    setLoading(true)
    api('get_orders').then(setOrders).finally(()=>setLoading(false))
  }
  useEffect(()=>{ load() },[])

  const submitToJT = async(ref: string) => {
    setSubmitting(ref); setMsg(null)
    try {
      const d = await api('submit_to_jt', { reference_no: ref })
      setMsg({ text: d.status==='synced' ? `✅ 同步成功！跟踪号: ${d.tracking_no}` : `⚠ 同步失败: ${d.jt_result?.cnmessage||'?'}`, ok: d.status==='synced' })
      load(); setSelected(null)
    } catch(e:any) { setMsg({text:'❌ '+e.message, ok:false}) }
    setSubmitting(null)
  }

  const deleteOrder = async(ref: string) => {
    if(!confirm(`确认删除订单 ${ref}？`)) return
    await api('delete_order', { reference_no: ref }); load()
  }

  const filtered = orders.filter(o=>{
    if(tab==='all')    return true
    if(tab==='review') return ['reviewing','pending'].includes(o.status)
    if(tab==='synced') return o.status==='synced'
    return ['sync_error','deleted'].includes(o.status)
  })

  const tabs = [{k:'all',l:'全部',c:orders.length},{k:'review',l:'待处理',c:orders.filter(o=>['reviewing','pending'].includes(o.status)).length},{k:'synced',l:'已同步',c:orders.filter(o=>o.status==='synced').length},{k:'error',l:'错误/删除',c:orders.filter(o=>['sync_error','deleted'].includes(o.status)).length}]

  const td:React.CSSProperties={padding:'11px 14px',borderBottom:'1px solid #dde3f5',fontSize:'12px',verticalAlign:'middle' as const}

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
        <div><h1 style={{fontSize:'20px',fontWeight:700}}>Órdenes / 订单管理</h1><p style={{fontSize:'13px',color:'#6b6560',marginTop:'3px'}}>{orders.length} órdenes en total</p></div>
        <button onClick={load} style={{padding:'8px 16px',borderRadius:'6px',background:'#eef2ff',border:'1px solid #c0cef5',cursor:'pointer',fontSize:'13px',fontWeight:600,color:'#2a4480'}}>↻ Actualizar</button>
      </div>

      {msg && <div style={{padding:'12px 16px',borderRadius:'6px',background:msg.ok?'#e8f8ef':'#fde8e8',border:`1px solid ${msg.ok?'#b4e8cb':'#f4b4b4'}`,color:msg.ok?'#2a9d5c':'#d63030',fontSize:'13px',marginBottom:'14px'}}>{msg.text}</div>}

      <div style={{display:'flex',gap:'0',borderBottom:'1px solid #dde3f5',marginBottom:'14px'}}>
        {tabs.map(t=><button key={t.k} onClick={()=>setTab(t.k)} style={{padding:'8px 16px',border:'none',borderBottom:`2px solid ${tab===t.k?'#2a4480':'transparent'}`,background:'none',color:tab===t.k?'#2a4480':'#6b6560',fontSize:'13px',fontWeight:tab===t.k?600:400,cursor:'pointer'}}>
          {t.l} <span style={{padding:'1px 6px',borderRadius:'10px',background:tab===t.k?'#eef2ff':'#f0ede8',color:tab===t.k?'#2a4480':'#6b6560',fontSize:'11px',fontWeight:600}}>{t.c}</span>
        </button>)}
      </div>

      <div style={{background:'#fff',border:'1px solid #dde3f5',borderRadius:'10px',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const}}>
          <thead><tr style={{background:'#f0f4ff'}}>
            {['Ref','Cliente','Destinatario','CP·Colonia','Ciudad','Tracking','Fecha','Estado','Acciones'].map(h=>(
              <th key={h} style={{padding:'10px 14px',textAlign:'left' as const,fontSize:'11px',fontWeight:700,color:'#6b6560',textTransform:'uppercase' as const,letterSpacing:'0.5px',borderBottom:'1px solid #dde3f5'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={9} style={{...td,textAlign:'center' as const,color:'#6b6560',padding:'40px'}}>Cargando...</td></tr>
            : filtered.length===0 ? <tr><td colSpan={9} style={{...td,textAlign:'center' as const,color:'#6b6560',padding:'40px'}}>No hay órdenes</td></tr>
            : filtered.map((o,i)=>{
              const d = o.data||{}
              const st = STATUS_STYLE[o.status]||{label:o.status,bg:'#f0ede8',color:'#6b6560'}
              const busy = submitting===o.reference_no
              return <tr key={o.id} style={{background:i%2===0?'#fff':'#fafbff'}}>
                <td style={{...td,fontFamily:'monospace',fontSize:'11px',color:'#2a4480',fontWeight:600}}>{o.reference_no}</td>
                <td style={{...td,fontSize:'11px'}}>{o.client_code}<br/><span style={{color:'#6b6560'}}>{o.client_name}</span></td>
                <td style={td}><div style={{fontWeight:500}}>{d.consignee_name}</div><div style={{fontSize:'11px',color:'#6b6560'}}>{d.consignee_phone}</div></td>
                <td style={{...td,fontSize:'11px'}}>{d.consignee_postcode}<br/>{d.consignee_colonia}</td>
                <td style={{...td,fontSize:'11px'}}>{d.shipping_city}</td>
                <td style={{...td,fontFamily:'monospace',fontSize:'11px',color:'#2a9d5c'}}>{o.tracking_no||'-'}</td>
                <td style={{...td,fontSize:'11px',color:'#6b6560'}}>{new Date(o.created_at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                <td style={td}><span style={{padding:'3px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:st.bg,color:st.color}}>{st.label}</span>
                  {o.sync_error&&<div style={{fontSize:'10px',color:'#d63030',marginTop:'2px'}}>{o.sync_error.slice(0,40)}</div>}</td>
                <td style={td}>
                  <div style={{display:'flex',gap:'5px',flexWrap:'wrap' as const}}>
                    {['reviewing','pending','sync_error'].includes(o.status)&&
                      <button onClick={()=>submitToJT(o.reference_no)} disabled={!!submitting} style={{padding:'4px 10px',borderRadius:'5px',background:busy?'#e0dbd2':'#2a9d5c',color:busy?'#6b6560':'#fff',border:'none',cursor:busy?'not-allowed':'pointer',fontSize:'11px',fontWeight:600}}>
                        {busy?'⟳ 同步中':'→ 同步J&T'}
                      </button>}
                    <button onClick={()=>setSelected(o)} style={{padding:'4px 10px',borderRadius:'5px',background:'#eef2ff',color:'#2a4480',border:'1px solid #c0cef5',cursor:'pointer',fontSize:'11px',fontWeight:600}}>详情</button>
                    {o.status!=='deleted'&&<button onClick={()=>deleteOrder(o.reference_no)} style={{padding:'4px 10px',borderRadius:'5px',background:'#fde8e8',color:'#d63030',border:'1px solid #f4b4b4',cursor:'pointer',fontSize:'11px',fontWeight:600}}>删除</button>}
                    {o.label_url&&<a href={o.label_url} target="_blank" style={{padding:'4px 10px',borderRadius:'5px',background:'#e0f5ec',color:'#2a9d5c',border:'1px solid #b4e8cb',textDecoration:'none',fontSize:'11px',fontWeight:600}}>面单</a>}
                  </div>
                </td>
              </tr>
            })}
          </tbody>
        </table>
      </div>

      {/* Detail modal */}
      {selected && (
        <div style={{position:'fixed' as const,inset:0,background:'rgba(0,0,0,.4)',zIndex:200,display:'flex',alignItems:'center',justifyContent:'center',padding:'20px'}} onClick={e=>e.target===e.currentTarget&&setSelected(null)}>
          <div style={{background:'#fff',borderRadius:'14px',width:'700px',maxWidth:'100%',maxHeight:'90vh',overflowY:'auto' as const,boxShadow:'0 8px 40px rgba(0,0,0,.2)'}}>
            <div style={{padding:'20px 24px',display:'flex',alignItems:'center',justifyContent:'space-between',borderBottom:'1px solid #e0dbd2'}}>
              <span style={{fontSize:'17px',fontWeight:700}}>订单详情: {selected.reference_no}</span>
              <button onClick={()=>setSelected(null)} style={{background:'none',border:'none',fontSize:'20px',cursor:'pointer',color:'#6b6560'}}>×</button>
            </div>
            <div style={{padding:'20px 24px',fontSize:'13px'}}>
              <pre style={{background:'#f5f4f0',padding:'14px',borderRadius:'7px',fontSize:'11px',overflow:'auto',fontFamily:'monospace',lineHeight:1.6}}>
                {JSON.stringify(selected.data, null, 2)}
              </pre>
              {['reviewing','pending','sync_error'].includes(selected.status) && (
                <button onClick={()=>submitToJT(selected.reference_no)} style={{marginTop:'14px',padding:'10px 20px',borderRadius:'7px',background:'#2a9d5c',color:'#fff',border:'none',cursor:'pointer',fontWeight:600,fontSize:'14px',fontFamily:'inherit'}}>
                  → 同步到J&T极兔
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
