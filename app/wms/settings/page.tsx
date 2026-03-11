'use client'
import { useState, useEffect, useCallback } from 'react'

interface BindStatus {
  bound: boolean
  authStatus?: number
  lastSyncAt?: string
  warehouseCount?: number
  tokenExpireAt?: string
}
interface SyncResult { success: boolean; message: string; duration?: string; todosCreated?: number; todosUpdated?: number }

// Use function instead of object lookup to avoid number-index TS error
function authLabel(code: number)      { return [,'已绑定','Token已过期','绑定失败'][code] ?? '未绑定' }
function authColor(code: number)      { return [,'#22c55e','#eab308','#ef4444'][code] ?? '#64748b' }
function authBg(code: number)         { return [,'#14532d33','#71320033','#7f1d1d33'][code] ?? '#1e293b' }
function authBorder(code: number)     { return [,'#16a34a44','#ca8a0444','#dc262644'][code] ?? '#2a3250' }
function authIcon(code: number)       { return [,'✅','⚠️','❌'][code] ?? '⭕' }

export default function SettingsPage() {
  const [status,    setStatus]    = useState<BindStatus | null>(null)
  const [appKey,    setAppKey]    = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [showPwd,   setShowPwd]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [syncing,   setSyncing]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')
  const [syncRes,   setSyncRes]   = useState<SyncResult | null>(null)
  const [tab,       setTab]       = useState<'bind' | 'guide'>('bind')

  const loadStatus = useCallback(async () => {
    try { const r = await fetch('/api/lingxing/bind'); setStatus(await r.json()) }
    catch { setStatus({ bound: false }) }
  }, [])

  useEffect(() => { loadStatus() }, [loadStatus])

  const handleBind = async () => {
    setError(''); setSuccess('')
    if (!appKey.trim() || !appSecret.trim()) { setError('AppKey 和 AppSecret 不能为空'); return }
    setLoading(true)
    try {
      const r = await fetch('/api/lingxing/bind', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001', appKey: appKey.trim(), appSecret: appSecret.trim() }) })
      const d = await r.json()
      if (!r.ok || !d.success) { setError(d.error || d.message || `绑定失败 (HTTP ${r.status})`) }
      else { setSuccess(d.message); setAppKey(''); setAppSecret(''); await loadStatus() }
    } catch { setError('网络错误，请重试') }
    finally { setLoading(false) }
  }

  const handleSync = async () => {
    setSyncing(true); setSyncRes(null)
    const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001'
    try { const r = await fetch('/api/lingxing/sync', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: DEFAULT_TENANT }) }); const d = await r.json(); setSyncRes(d); if (d.success) await loadStatus() }
    catch { setSyncRes({ success: false, message: '同步请求失败' }) }
    finally { setSyncing(false) }
  }

  const handleUnbind = async () => {
    if (!confirm('确认解绑领星账号？')) return
    try {
      const r = await fetch('/api/lingxing/bind', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tenantId: process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID || 'a0000000-0000-0000-0000-000000000001' }) })
      const d = await r.json()
      if (d.success) { setSuccess('已成功解绑'); await loadStatus() } else setError(d.error)
    } catch { setError('解绑失败') }
  }

  const code    = status?.authStatus ?? 0
  const isBound = status?.bound

  const inp: React.CSSProperties = { width: '100%', padding: '11px 14px', borderRadius: '8px', background: '#0f1117', border: '1px solid #2a3250', color: '#e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box', fontFamily: 'monospace' }
  const card: React.CSSProperties = { background: '#1c2333', border: '1px solid #2a3250', borderRadius: '14px', padding: '24px', marginBottom: '20px' }

  return (
    <div style={{ minHeight: '100vh', background: '#0f1117', color: '#e2e8f0', padding: '32px', overflowY: 'auto' as const }}>
      <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>系统设置</h1>
      <p style={{ fontSize: '13px', color: '#64748b', marginBottom: '28px' }}>管理领星WMS账号绑定、数据同步配置</p>

      <div style={{ display: 'flex', gap: '24px', maxWidth: '1000px' }}>
        <div style={{ flex: 1 }}>

          {/* Status card */}
          <div style={card}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: isBound ? '16px' : 0 }}>
              <div style={{ width: '44px', height: '44px', borderRadius: '12px', background: isBound ? '#14532d44' : '#1e293b', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '22px' }}>
                🗄️
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>领星 WMS 账号</div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>绑定后自动拉取数据生成待办</div>
              </div>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600, background: authBg(code), color: authColor(code), border: `1px solid ${authBorder(code)}` }}>
                {authIcon(code)} {authLabel(code)}
              </span>
            </div>

            {isBound && (
              <>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>
                  {[
                    { label: '授权仓库',  value: `${status?.warehouseCount ?? 0} 个` },
                    { label: '最后同步',  value: status?.lastSyncAt ? new Date(status.lastSyncAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '从未' },
                    { label: 'Token到期', value: status?.tokenExpireAt ? new Date(status.tokenExpireAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' }) : '未知' },
                  ].map(({ label, value }) => (
                    <div key={label} style={{ background: '#0f1117', borderRadius: '8px', padding: '10px 14px', border: '1px solid #2a3250' }}>
                      <div style={{ fontSize: '11px', color: '#64748b', marginBottom: '4px' }}>{label}</div>
                      <div style={{ fontSize: '13px', fontWeight: 600 }}>{value}</div>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: '10px' }}>
                  <button onClick={handleSync} disabled={syncing} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', borderRadius: '8px', border: 'none', background: syncing ? '#1e293b' : 'linear-gradient(135deg,#3b82f6,#2563eb)', color: syncing ? '#64748b' : 'white', fontSize: '13px', fontWeight: 600, cursor: syncing ? 'not-allowed' : 'pointer' }}>
                    {syncing ? '⏳ 同步中...' : '▶ 立即同步'}
                  </button>
                  <button onClick={handleUnbind} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '9px 18px', borderRadius: '8px', border: '1px solid #7f1d1d44', background: '#7f1d1d11', color: '#ef4444', fontSize: '13px', cursor: 'pointer' }}>
                    ✖ 解绑账号
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Tabs */}
          <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', background: '#1c2333', padding: '4px', borderRadius: '10px', border: '1px solid #2a3250' }}>
            {(['bind', 'guide'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ flex: 1, padding: '8px', borderRadius: '7px', border: 'none', background: tab === t ? '#222840' : 'transparent', color: tab === t ? '#3b82f6' : '#64748b', fontSize: '13px', fontWeight: tab === t ? 600 : 400, cursor: 'pointer' }}>
                {t === 'bind' ? (isBound ? '更新绑定' : '绑定账号') : '如何获取 AppKey？'}
              </button>
            ))}
          </div>

          {/* Bind form */}
          {tab === 'bind' && (
            <div style={card}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '20px' }}>🔗 {isBound ? '重新配置 API 凭证' : '填写 API 凭证'}</div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '7px' }}>AppKey <span style={{ color: '#ef4444' }}>*</span></label>
                <input type="text" value={appKey} onChange={e => setAppKey(e.target.value)} placeholder="请输入领星开放平台的 AppKey" style={inp}
                  onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#2a3250')} />
              </div>

              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '7px' }}>AppSecret <span style={{ color: '#ef4444' }}>*</span></label>
                <div style={{ position: 'relative' }}>
                  <input type={showPwd ? 'text' : 'password'} value={appSecret} onChange={e => setAppSecret(e.target.value)} placeholder="请输入领星开放平台的 AppSecret" style={{ ...inp, paddingRight: '44px' }}
                    onFocus={e => (e.target.style.borderColor = '#3b82f6')} onBlur={e => (e.target.style.borderColor = '#2a3250')} />
                  <button onClick={() => setShowPwd(!showPwd)} style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', cursor: 'pointer', color: '#64748b', fontSize: '16px' }}>
                    {showPwd ? '🙈' : '👁'}
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>🔒 AppSecret 使用 AES-256 加密存储</p>
              </div>

              {error   && <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#ef4444', fontSize: '13px' }}>⚠️ {error}</div>}
              {success && <div style={{ padding: '10px 14px', borderRadius: '8px', marginBottom: '16px', background: '#14532d22', border: '1px solid #14532d44', color: '#22c55e', fontSize: '13px' }}>✅ {success}</div>}
              {syncRes && (
                <div style={{ padding: '12px 14px', borderRadius: '8px', marginBottom: '16px', background: syncRes.success ? '#14532d22' : '#7f1d1d22', border: `1px solid ${syncRes.success ? '#14532d44' : '#7f1d1d44'}`, color: syncRes.success ? '#22c55e' : '#ef4444', fontSize: '13px' }}>
                  <div style={{ fontWeight: 600 }}>{syncRes.message}</div>
                  {syncRes.success && <div style={{ fontSize: '12px', color: '#94a3b8', marginTop: '4px' }}>耗时 {syncRes.duration} · 新建 {syncRes.todosCreated} · 更新 {syncRes.todosUpdated}</div>}
                </div>
              )}

              <button onClick={handleBind} disabled={loading} style={{ width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: loading ? '#1e293b' : 'linear-gradient(135deg,#3b82f6,#2563eb)', color: loading ? '#64748b' : 'white', fontSize: '14px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer' }}>
                {loading ? '⏳ 验证中...' : `🔗 ${isBound ? '更新绑定' : '验证并绑定'}`}
              </button>
            </div>
          )}

          {/* Guide */}
          {tab === 'guide' && (
            <div style={card}>
              <div style={{ fontSize: '14px', fontWeight: 700, marginBottom: '20px' }}>ℹ️ 如何获取 AppKey 和 AppSecret</div>
              {[
                { n: '1', title: '登录领星 WMS 后台',    desc: '使用管理员账号登录领星 WMS（OMP端）' },
                { n: '2', title: '进入开放平台设置',       desc: '设置 → 开放平台 → 应用管理' },
                { n: '3', title: '创建新应用',             desc: '填写应用名，勾选权限：入库、出库、库存、退货、工单' },
                { n: '4', title: '配置回调地址',           desc: '填写您的域名，如：https://your-app.vercel.app' },
                { n: '5', title: '复制 AppKey / AppSecret', desc: '创建成功后复制到绑定表单' },
              ].map(({ n, title, desc }, i, arr) => (
                <div key={n} style={{ display: 'flex', gap: '14px', padding: '14px 0', borderBottom: i < arr.length - 1 ? '1px solid #2a3250' : 'none' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#3b82f622', border: '1px solid #3b82f644', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '12px', fontWeight: 700, color: '#3b82f6', flexShrink: 0 }}>{n}</div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{title}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>{desc}</div>
                  </div>
                </div>
              ))}
              <div style={{ marginTop: '16px', background: '#0f2744', border: '1px solid #1d4ed844', borderRadius: '8px', padding: '12px 14px', fontSize: '12px', color: '#93c5fd' }}>
                💡 如找不到「开放平台」菜单，请联系领星客服开通 API 权限
              </div>
            </div>
          )}
        </div>

        {/* Right info panel */}
        <div style={{ width: '260px', flexShrink: 0 }}>
          <div style={card}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '14px' }}>📡 自动同步内容</div>
            {['📦 待入库单', '🔼 待上架单', '🚚 一件代发', '🏭 送仓出库', '📊 库存预警', '↩ 退件处理', '📋 工单审批'].map(item => (
              <div key={item} style={{ display: 'flex', justifyContent: 'space-between', padding: '7px 0', borderBottom: '1px solid #2a325033', fontSize: '12px' }}>
                <span>{item}</span><span style={{ color: '#22c55e' }}>✓</span>
              </div>
            ))}
          </div>
          <div style={{ background: '#1c2333', border: '1px solid #2a3250', borderRadius: '14px', padding: '20px' }}>
            <div style={{ fontSize: '13px', fontWeight: 700, color: '#94a3b8', marginBottom: '10px' }}>⏱️ 同步频率</div>
            <div style={{ fontSize: '13px', color: '#3b82f6', fontWeight: 600, marginBottom: '6px' }}>每 15 分钟自动同步</div>
            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: 1.7 }}>同一单号不会重复创建待办，已完成的待办不会被重新激活。</div>
          </div>
        </div>
      </div>
    </div>
  )
}
