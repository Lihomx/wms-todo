'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [showPwd,  setShowPwd]  = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError('')
    try {
      const supabase = getSupabaseBrowserClient()
      const { error: err } = await supabase.auth.signInWithPassword({ email, password })
      if (err) { setError(err.message); setLoading(false); return }
      router.push('/warehouse/dashboard')
    } catch {
      setError('登录失败，请重试')
      setLoading(false)
    }
  }

  const inp: React.CSSProperties = {
    width:'100%', padding:'11px 14px', borderRadius:'8px',
    border:'1px solid #e2e8f0', background:'#f8fafc',
    color:'#0f172a', fontSize:'14px', outline:'none',
    boxSizing:'border-box' as const, transition:'border-color 0.15s',
  }

  return (
    <div style={{minHeight:'100vh',background:'#f8fafc',display:'flex',alignItems:'center',justifyContent:'center',fontFamily:"'Segoe UI',system-ui,sans-serif"}}>
      <div style={{width:'100%',maxWidth:'380px',padding:'0 20px'}}>
        {/* Logo */}
        <div style={{textAlign:'center' as const,marginBottom:'32px'}}>
          <div style={{width:'52px',height:'52px',borderRadius:'14px',background:'#2563eb',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'24px',margin:'0 auto 12px'}}>🏭</div>
          <h1 style={{fontSize:'22px',fontWeight:700,color:'#0f172a',marginBottom:'4px'}}>海外仓 WMS</h1>
          <p style={{fontSize:'13px',color:'#64748b'}}>仓库管理系统</p>
        </div>

        {/* Card */}
        <div style={{background:'#fff',borderRadius:'14px',border:'1px solid #e2e8f0',padding:'28px',boxShadow:'0 4px 6px -1px rgba(0,0,0,0.07),0 2px 4px -1px rgba(0,0,0,0.04)'}}>
          <h2 style={{fontSize:'16px',fontWeight:600,color:'#0f172a',marginBottom:'20px'}}>登录账号</h2>
          <form onSubmit={handleLogin}>
            <div style={{marginBottom:'14px'}}>
              <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#475569',marginBottom:'5px'}}>邮箱</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required style={inp}
                onFocus={e=>(e.target as HTMLInputElement).style.borderColor='#2563eb'}
                onBlur={e=>(e.target as HTMLInputElement).style.borderColor='#e2e8f0'}/>
            </div>
            <div style={{marginBottom:'20px'}}>
              <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#475569',marginBottom:'5px'}}>密码</label>
              <div style={{position:'relative'}}>
                <input type={showPwd?'text':'password'} value={password} onChange={e=>setPassword(e.target.value)} placeholder="输入密码" required style={{...inp,paddingRight:'44px'}}
                  onFocus={e=>(e.target as HTMLInputElement).style.borderColor='#2563eb'}
                  onBlur={e=>(e.target as HTMLInputElement).style.borderColor='#e2e8f0'}/>
                <button type="button" onClick={()=>setShowPwd(s=>!s)} style={{position:'absolute',right:'12px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'15px'}}>{showPwd?'🙈':'👁'}</button>
              </div>
            </div>
            {error && <div style={{padding:'9px 12px',borderRadius:'7px',marginBottom:'14px',background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',fontSize:'13px'}}>⚠️ {error}</div>}
            <button type="submit" disabled={loading} style={{width:'100%',padding:'11px',borderRadius:'8px',border:'none',background:loading?'#e2e8f0':'#2563eb',color:loading?'#94a3b8':'white',fontSize:'14px',fontWeight:600,cursor:loading?'not-allowed':'pointer',transition:'background 0.15s'}}>
              {loading?'登录中...':'登录'}
            </button>
          </form>
        </div>
        <p style={{textAlign:'center' as const,marginTop:'16px',fontSize:'12px',color:'#94a3b8'}}>海外仓 WMS · 仓库管理系统</p>
      </div>
    </div>
  )
}
