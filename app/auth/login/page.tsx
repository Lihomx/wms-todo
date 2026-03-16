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
    
    const { error: err } = await getSupabaseBrowserClient().auth.signInWithPassword({
      email: email.trim(),
      password,
    })
    
    if (err) {
      setError(err.message === 'Invalid login credentials' ? '邮箱或密码错误' : err.message)
      setLoading(false)
      return
    }
    
    router.push('/warehouse/dashboard')
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '8px',
    border: '1px solid #e2e8f0', background: '#f8fafc',
    color: '#0f172a', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '380px', padding: '0 20px' }}>
        <div style={{ textAlign: 'center' as const, marginBottom: '32px' }}>
          <div style={{ width: '56px', height: '56px', borderRadius: '14px', background: '#2563eb', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '26px', margin: '0 auto 14px', boxShadow: '0 4px 14px rgba(37,99,235,0.3)' }}>🏭</div>
          <h1 style={{ fontSize: '22px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>海外仓 WMS</h1>
          <p style={{ fontSize: '13px', color: '#64748b' }}>仓库管理系统 · 请登录</p>
        </div>

        <div style={{ background: '#fff', borderRadius: '14px', border: '1px solid #e2e8f0', padding: '28px', boxShadow: '0 4px 6px -1px rgba(0,0,0,0.07)' }}>
          <form onSubmit={handleLogin}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>邮箱</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="管理员邮箱" required autoFocus style={inp} />
            </div>
            <div style={{ marginBottom: '22px' }}>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px' }}>密码</label>
              <div style={{ position: 'relative' }}>
                <input type={showPwd ? 'text' : 'password'} value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="输入密码" required style={{ ...inp, paddingRight: '44px' }} />
                <button type="button" onClick={() => setShowPwd(s => !s)}
                  style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#94a3b8', fontSize: '15px' }}>
                  {showPwd ? '🙈' : '👁'}
                </button>
              </div>
            </div>

            {error && (
              <div style={{ padding: '10px 12px', borderRadius: '7px', marginBottom: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>
                ⚠️ {error}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              background: loading ? '#e2e8f0' : '#2563eb',
              color: loading ? '#94a3b8' : 'white',
              fontSize: '14px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? '登录中...' : '登录'}
            </button>
          </form>
        </div>
        <p style={{ textAlign: 'center' as const, marginTop: '16px', fontSize: '12px', color: '#94a3b8' }}>
          没有账号？请联系管理员在 Supabase 后台创建
        </p>
      </div>
    </div>
  )
}
