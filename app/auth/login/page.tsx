'use client'
import { useState } from 'react'
import { getSupabaseBrowserClient } from '@/lib/supabase-browser'

export default function LoginPage() {
  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [debug,    setDebug]    = useState('')
  const [showPwd,  setShowPwd]  = useState(false)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true); setError(''); setDebug('')

    const supabase = getSupabaseBrowserClient()
    setDebug('正在登录...')

    const { data, error: err } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    })

    if (err) {
      setError(err.message === 'Invalid login credentials' ? '邮箱或密码错误' : err.message)
      setDebug(`登录失败: ${err.message}`)
      setLoading(false)
      return
    }

    setDebug(`登录成功! user=${data.user?.email}, session=${data.session ? '有' : '无'}`)

    // Verify session was saved
    await new Promise(r => setTimeout(r, 300))
    const { data: check } = await supabase.auth.getSession()
    setDebug(prev => prev + `\ngetSession后: ${check.session ? '有session ✅' : '无session ❌'}`)

    if (!check.session) {
      setError('Session未能保存，请检查浏览器设置（是否禁用了localStorage？）')
      setLoading(false)
      return
    }

    setDebug(prev => prev + '\n跳转中...')
    await new Promise(r => setTimeout(r, 500))
    window.location.href = '/warehouse/dashboard'
  }

  const inp: React.CSSProperties = {
    width: '100%', padding: '11px 14px', borderRadius: '8px',
    border: '1px solid #e2e8f0', background: '#f8fafc',
    color: '#0f172a', fontSize: '14px', outline: 'none',
    boxSizing: 'border-box' as const,
  }

  return (
    <div style={{ minHeight: '100vh', background: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: "'Segoe UI',system-ui,-apple-system,sans-serif" }}>
      <div style={{ width: '100%', maxWidth: '400px', padding: '0 20px' }}>
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
              <div style={{ padding: '10px 12px', borderRadius: '7px', marginBottom: '12px', background: '#fef2f2', border: '1px solid #fecaca', color: '#dc2626', fontSize: '13px' }}>
                ⚠️ {error}
              </div>
            )}

            {debug && (
              <div style={{ padding: '10px 12px', borderRadius: '7px', marginBottom: '12px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', fontSize: '12px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' as const }}>
                {debug}
              </div>
            )}

            <button type="submit" disabled={loading} style={{
              width: '100%', padding: '12px', borderRadius: '8px', border: 'none',
              background: loading ? '#e2e8f0' : '#2563eb',
              color: loading ? '#94a3b8' : 'white',
              fontSize: '14px', fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}>
              {loading ? '处理中...' : '登录'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}
