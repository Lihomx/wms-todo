'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function JTAdminLogin() {
  const [user, setUser] = useState('admin')
  const [pass, setPass] = useState('')
  const [err,  setErr]  = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const login = async(e: React.FormEvent) => {
    e.preventDefault()
    setErr(''); setLoading(true)
    const r = await fetch('/api/jt?action=admin_login', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ username: user, password: pass })
    })
    const d = await r.json()
    if (!d.success) { setErr(d.msg); setLoading(false); return }
    sessionStorage.setItem('jt_admin_session', JSON.stringify(d.data))
    router.replace('/jt-admin/orders')
  }

  return (
    <div style={{minHeight:'100vh',background:'#f0f4ff',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <div style={{background:'#fff',border:'1px solid #dde3f5',borderRadius:'16px',padding:'40px',width:'400px',boxShadow:'0 8px 40px rgba(42,68,128,.12)'}}>
        <div style={{textAlign:'center' as const,marginBottom:'32px'}}>
          <div style={{width:'52px',height:'52px',borderRadius:'12px',background:'#2a4480',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:'22px',color:'#fff'}}>⚙</div>
          <h1 style={{fontSize:'22px',fontWeight:700,marginBottom:'6px'}}>Panel Administrador</h1>
          <p style={{fontSize:'13px',color:'#6b6560'}}>极兔打单系统 · 管理后台</p>
        </div>
        <form onSubmit={login}>
          <div style={{marginBottom:'14px'}}>
            <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#6b6560',textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:'6px'}}>Usuario</label>
            <input value={user} onChange={e=>setUser(e.target.value)} required style={{width:'100%',padding:'10px 12px',border:'1.5px solid #dde3f5',borderRadius:'6px',fontSize:'14px',outline:'none',fontFamily:'inherit'}}/>
          </div>
          <div style={{marginBottom:'20px'}}>
            <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#6b6560',textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:'6px'}}>Contraseña</label>
            <input type="password" value={pass} onChange={e=>setPass(e.target.value)} required autoFocus style={{width:'100%',padding:'10px 12px',border:'1.5px solid #dde3f5',borderRadius:'6px',fontSize:'14px',outline:'none',fontFamily:'inherit'}}/>
          </div>
          {err && <div style={{padding:'10px 14px',borderRadius:'6px',background:'#fde8e8',color:'#d63030',fontSize:'13px',marginBottom:'14px'}}>⚠ {err}</div>}
          <button type="submit" disabled={loading} style={{width:'100%',padding:'12px',borderRadius:'6px',background:'#2a4480',color:'#fff',border:'none',fontSize:'14px',fontWeight:600,cursor:loading?'not-allowed':'pointer',fontFamily:'inherit'}}>
            {loading ? '...' : '🔑 Ingresar al Panel'}
          </button>
          <div style={{textAlign:'center' as const,marginTop:'16px',fontSize:'13px',color:'#6b6560'}}>
            ¿Cliente? <a href="/jt/login" style={{color:'#e85d2f',textDecoration:'none',fontWeight:500}}>Ir al sistema</a>
          </div>
        </form>
      </div>
    </div>
  )
}
