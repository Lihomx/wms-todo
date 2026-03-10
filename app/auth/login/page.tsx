'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router   = useRouter()
  const supabase = getSupabaseBrowserClient()

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')

  const handleLogin = async () => {
    setError('')
    if (!email || !password) { setError('请填写邮箱和密码'); return }
    setLoading(true)
    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
      if (authError) { setError(authError.message === 'Invalid login credentials' ? '邮箱或密码错误' : authError.message); return }
      router.push('/wms/dashboard')
    } catch {
      setError('登录失败，请重试')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f1117',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Noto Sans SC', sans-serif",
    }}>
      <div style={{
        width: '380px', background: '#1c2333',
        border: '1px solid #2a3250', borderRadius: '16px', padding: '36px',
      }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '16px',
            background: 'linear-gradient(135deg,#3b82f6,#06b6d4)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '24px', fontWeight: 700, color: 'white',
            margin: '0 auto 14px',
          }}>仓</div>
          <div style={{ fontSize: '18px', fontWeight: 700, marginBottom: '6px' }}>海外仓 WMS</div>
          <div style={{ fontSize: '13px', color: '#64748b' }}>待办管理系统</div>
        </div>

        {/* Form */}
        {[
          { label: '邮箱',  value: email,    set: setEmail,    type: 'email',    placeholder: '请输入邮箱' },
          { label: '密码',  value: password, set: setPassword, type: 'password', placeholder: '请输入密码' },
        ].map(({ label, value, set, type, placeholder }) => (
          <div key={label} style={{ marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '7px' }}>
              {label}
            </label>
            <input
              type={type}
              value={value}
              onChange={e => set(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleLogin()}
              placeholder={placeholder}
              style={{
                width: '100%', padding: '11px 14px', borderRadius: '8px',
                background: '#0f1117', border: '1px solid #2a3250',
                color: '#e2e8f0', fontSize: '13px', outline: 'none',
                boxSizing: 'border-box', transition: 'border-color .2s',
              }}
              onFocus={e => e.target.style.borderColor = '#3b82f6'}
              onBlur={e => e.target.style.borderColor = '#2a3250'}
            />
          </div>
        ))}

        {error && (
          <div style={{
            padding: '9px 12px', borderRadius: '7px', marginBottom: '16px',
            background: '#7f1d1d22', border: '1px solid #7f1d1d44',
            color: '#ef4444', fontSize: '13px',
          }}>{error}</div>
        )}

        <button
          onClick={handleLogin}
          disabled={loading}
          style={{
            width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
            background: loading ? '#1e293b' : 'linear-gradient(135deg,#3b82f6,#2563eb)',
            color: 'white', fontSize: '14px', fontWeight: 700,
            cursor: loading ? 'not-allowed' : 'pointer',
            boxShadow: loading ? 'none' : '0 0 20px #3b82f644',
            transition: 'all .2s',
          }}
        >
          {loading ? '登录中...' : '登录'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '20px', fontSize: '12px', color: '#64748b' }}>
          首次使用？请联系管理员创建账号
        </div>
      </div>
    </div>
  )
}
