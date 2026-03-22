'use client'
import { useState, useEffect } from 'react'

function getAdminSession() {
  if(typeof window==='undefined') return null
  try { return JSON.parse(sessionStorage.getItem('jt_admin_session')||'null') } catch { return null }
}
function api(action:string, body:object={}) {
  const s = getAdminSession()
  return fetch(`/api/jt?action=${action}`, {
    method:'POST', headers:{'Content-Type':'application/json','x-session-token':s?.token||''},
    body:JSON.stringify(body)
  }).then(r=>r.json()).then(d=>{ if(!d.success) throw new Error(d.msg); return d.data })
}

const inp:React.CSSProperties={width:'100%',padding:'9px 12px',border:'1.5px solid #dde3f5',borderRadius:'6px',fontSize:'13px',outline:'none',fontFamily:'inherit',background:'#f8faff',boxSizing:'border-box' as const}

export default function JTAdminClients() {
  const [clients, setClients] = useState<any[]>([])
  const [form,    setForm]    = useState({id:'',username:'',password:'',name:'',company:'',email:'',phone:'',clientCode:''})
  const [showing, setShowing] = useState(false)
  const [saving,  setSaving]  = useState(false)
  const [msg,     setMsg]     = useState<{text:string;ok:boolean}|null>(null)

  const load = () => api('get_clients').then(setClients)
  useEffect(()=>{ load() },[])

  const save = async() => {
    setSaving(true); setMsg(null)
    try {
      await api('save_client', form)
      setMsg({text:'✅ Cliente guardado', ok:true})
      setShowing(false); setForm({id:'',username:'',password:'',name:'',company:'',email:'',phone:'',clientCode:''})
      load()
    } catch(e:any) { setMsg({text:'❌ '+e.message,ok:false}) }
    setSaving(false)
  }
  const del = async(id:string, name:string) => {
    if(!confirm(`¿Eliminar cliente ${name}？`)) return
    await api('delete_client', {id}); load()
  }

  const lbl=(t:string)=><label style={{fontSize:'11px',fontWeight:600,color:'#6b6560',display:'block',marginBottom:'4px',textTransform:'uppercase' as const,letterSpacing:'0.5px'}}>{t}</label>

  return (
    <div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
        <div><h1 style={{fontSize:'20px',fontWeight:700}}>Clientes / 客户管理</h1><p style={{fontSize:'13px',color:'#6b6560',marginTop:'3px'}}>{clients.length} clientes registrados</p></div>
        <button onClick={()=>setShowing(true)} style={{padding:'9px 18px',borderRadius:'6px',background:'#2a4480',color:'#fff',border:'none',cursor:'pointer',fontWeight:600,fontSize:'13px',fontFamily:'inherit'}}>+ Nuevo cliente</button>
      </div>

      {msg && <div style={{padding:'10px 14px',borderRadius:'6px',background:msg.ok?'#e8f8ef':'#fde8e8',color:msg.ok?'#2a9d5c':'#d63030',fontSize:'13px',marginBottom:'14px'}}>{msg.text}</div>}

      {showing && (
        <div style={{background:'#fff',border:'1px solid #dde3f5',borderRadius:'10px',padding:'20px',marginBottom:'16px'}}>
          <div style={{fontSize:'15px',fontWeight:700,marginBottom:'14px'}}>Nuevo cliente / 添加客户</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
            <div>{lbl('Usuario *')}<input value={form.username} onChange={e=>setForm(f=>({...f,username:e.target.value}))} style={inp}/></div>
            <div>{lbl('Contraseña * (min 6)')}<input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} style={inp}/></div>
            <div>{lbl('Nombre completo')}<input value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} style={inp}/></div>
            <div>{lbl('Empresa')}<input value={form.company} onChange={e=>setForm(f=>({...f,company:e.target.value}))} style={inp}/></div>
            <div>{lbl('Código de cliente')}<input value={form.clientCode} onChange={e=>setForm(f=>({...f,clientCode:e.target.value}))} placeholder="Ej: LIHO001" style={inp}/></div>
            <div>{lbl('Teléfono')}<input value={form.phone} onChange={e=>setForm(f=>({...f,phone:e.target.value}))} style={inp}/></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={save} disabled={saving} style={{padding:'9px 20px',borderRadius:'6px',background:saving?'#c0cef5':'#2a4480',color:'#fff',border:'none',cursor:saving?'not-allowed':'pointer',fontWeight:600,fontSize:'13px',fontFamily:'inherit'}}>{saving?'Guardando...':'✓ Guardar'}</button>
            <button onClick={()=>setShowing(false)} style={{padding:'9px 14px',borderRadius:'6px',background:'#f0f4ff',border:'1px solid #dde3f5',cursor:'pointer',fontSize:'13px'}}>Cancelar</button>
          </div>
        </div>
      )}

      <div style={{background:'#fff',border:'1px solid #dde3f5',borderRadius:'10px',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const}}>
          <thead><tr style={{background:'#f0f4ff'}}>
            {['Usuario','Nombre','Empresa','Código cliente','Teléfono','Acciones'].map(h=>(
              <th key={h} style={{padding:'10px 14px',textAlign:'left' as const,fontSize:'11px',fontWeight:700,color:'#6b6560',textTransform:'uppercase' as const,letterSpacing:'0.5px',borderBottom:'1px solid #dde3f5'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {clients.length===0 ? <tr><td colSpan={6} style={{padding:'40px',textAlign:'center' as const,color:'#6b6560'}}>No hay clientes</td></tr>
            : clients.map((c,i)=>(
              <tr key={c.id} style={{background:i%2===0?'#fff':'#fafbff'}}>
                <td style={{padding:'11px 14px',fontSize:'13px',fontWeight:600,color:'#2a4480'}}>{c.username}</td>
                <td style={{padding:'11px 14px',fontSize:'13px'}}>{c.name}</td>
                <td style={{padding:'11px 14px',fontSize:'13px',color:'#6b6560'}}>{c.company}</td>
                <td style={{padding:'11px 14px',fontFamily:'monospace',fontSize:'12px',color:'#2a9d5c'}}>{c.client_code}</td>
                <td style={{padding:'11px 14px',fontSize:'13px',color:'#6b6560'}}>{c.phone}</td>
                <td style={{padding:'11px 14px'}}>
                  <button onClick={()=>del(c.id, c.name)} style={{padding:'4px 12px',borderRadius:'5px',background:'#fde8e8',color:'#d63030',border:'1px solid #f4b4b4',cursor:'pointer',fontSize:'12px',fontWeight:600}}>Eliminar</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
