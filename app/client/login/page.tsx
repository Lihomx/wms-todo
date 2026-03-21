'use client'
import { useState, useEffect } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function ClientLoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const router     = useRouter()
  const params     = useSearchParams()

  useEffect(()=>{
    const token = params.get('token')
    if (!token) return
    // Token-based auto-login from warehouse admin
    setLoading(true)
    setError('')
    fetch(`/api/impersonate?token=${token}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); setLoading(false); return }
        // Store impersonation session in sessionStorage (tab-isolated, clears on close)
        sessionStorage.setItem('wms_client_session', JSON.stringify({
          customerCode: d.customerCode,
          customerName: d.customerName,
          displayName:  d.customerName,
          email:        `admin@${d.customerCode.toLowerCase()}`,
          isActive:     true,
          isImpersonated: true,
        }))
        // Use window.location for hard navigation so layout re-reads sessionStorage cleanly
        window.location.href = '/client/dashboard'
      })
      .catch(() => { setError('令牌验证失败，请重新点击进入'); setLoading(false) })
  }, [params, router])

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    const supabase = getSupabaseBrowserClient()
    const { error: err } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
    if (err) { setError(err.message === 'Invalid login credentials' ? '邮箱或密码错误' : err.message); setLoading(false); return }
    const infoRes = await fetch('/api/auth-info')
    const info    = await infoRes.json()
    if (info.role === 'warehouse_admin') {
      await supabase.auth.signOut()
      setError('此入口仅供客户账号登录，仓库管理员请使用主登录页')
      setLoading(false); return
    }
    if (!info.isActive) {
      await supabase.auth.signOut()
      setError('账号已停用，请联系仓库管理员')
      setLoading(false); return
    }
    router.replace('/client/dashboard')
  }

  const inp: React.CSSProperties = { width:'100%',padding:'11px 14px',borderRadius:'8px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#0f172a',fontSize:'14px',outline:'none',boxSizing:'border-box' as const }
  const isTokenLogin = !!params.get('token')

  return (
    <div style={{minHeight:'100vh',background:'linear-gradient(135deg,#eff6ff 0%,#f8fafc 50%,#f0fdf4 100%)',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{width:'100%',maxWidth:'380px',padding:'0 20px'}}>
        <div style={{textAlign:'center' as const,marginBottom:'32px'}}>
          <div style={{width:'56px',height:'56px',borderRadius:'14px',background:'linear-gradient(135deg,#2563eb,#7c3aed)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',margin:'0 auto 14px',boxShadow:'0 4px 14px rgba(37,99,235,0.3)'}}>📦</div>
          <h1 style={{fontSize:'22px',fontWeight:700,color:'#0f172a',marginBottom:'4px'}}>客户管理系统</h1>
          <p style={{fontSize:'13px',color:'#64748b'}}>Cliente · {isTokenLogin ? '正在验证身份...' : '请登录您的账号'}</p>
        </div>
        <div style={{background:'#fff',borderRadius:'14px',border:'1px solid #e2e8f0',padding:'28px',boxShadow:'0 4px 6px -1px rgba(0,0,0,0.07)'}}>
          {isTokenLogin ? (
            <div style={{textAlign:'center' as const,padding:'20px 0'}}>
              {loading && <div style={{fontSize:'14px',color:'#64748b'}}>⟳ 正在登录...</div>}
              {error && <div style={{padding:'10px 12px',borderRadius:'7px',background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',fontSize:'13px'}}>⚠️ {error}<br/><button onClick={()=>window.close()} style={{marginTop:'10px',padding:'6px 14px',borderRadius:'6px',background:'#f8fafc',border:'1px solid #e2e8f0',cursor:'pointer',fontSize:'12px'}}>关闭</button></div>}
            </div>
          ) : (
            <form onSubmit={handleLogin}>
              <div style={{marginBottom:'16px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#475569',marginBottom:'6px'}}>邮箱 / Email</label>
                <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="su@email.com" required autoFocus style={inp}/>
              </div>
              <div style={{marginBottom:'22px'}}>
                <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#475569',marginBottom:'6px'}}>密码 / Contraseña</label>
                <div style={{position:'relative'}}>
                  <input type={showPwd?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={{...inp,paddingRight:'44px'}}/>
                  <button type="button" onClick={()=>setShowPwd(s=>!s)} style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'15px'}}>{showPwd?'🙈':'👁'}</button>
                </div>
              </div>
              {error && <div style={{padding:'10px 12px',borderRadius:'7px',marginBottom:'16px',background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',fontSize:'13px'}}>⚠️ {error}</div>}
              <button type="submit" disabled={loading} style={{width:'100%',padding:'12px',borderRadius:'8px',border:'none',background:loading?'#e2e8f0':'#2563eb',color:loading?'#94a3b8':'white',fontSize:'14px',fontWeight:600,cursor:loading?'not-allowed':'pointer'}}>
                {loading?'登录中...':'登录 / Iniciar sesión'}
              </button>
            </form>
          )}
        </div>
        {!isTokenLogin && (
          <p style={{textAlign:'center' as const,marginTop:'16px',fontSize:'12px',color:'#94a3b8'}}>
            仓库管理员？<a href="/auth/login" style={{color:'#2563eb',textDecoration:'none'}}>点击这里登录</a>
          </p>
        )}
      </div>
    </div>
  )
}
