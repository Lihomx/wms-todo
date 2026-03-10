'use client'
// app/wms/settings/page.tsx
// 领星账号绑定页面

import { useState, useEffect, useCallback } from 'react'
import {
  Link, CheckCircle, XCircle, RefreshCw, Unlink,
  Eye, EyeOff, AlertTriangle, Loader2, Warehouse,
  Clock, Database, Play, Info
} from 'lucide-react'

// ── 类型 ────────────────────────────────────────────────────
interface BindStatus {
  bound: boolean
  authStatus?: number
  lastSyncAt?: string
  warehouseCount?: number
  syncEnabled?: boolean
  tokenExpireAt?: string
}

interface SyncResult {
  success: boolean
  message: string
  duration?: string
  todosCreated?: number
  todosUpdated?: number
}

// ── 状态颜色配置 ──────────────────────────────────────────────
const AUTH_STATUS = {
  0: { label: '未绑定',   color: 'text-gray-400',   bg: 'bg-gray-800',  icon: XCircle },
  1: { label: '已绑定',   color: 'text-green-400',  bg: 'bg-green-900', icon: CheckCircle },
  2: { label: 'Token已过期', color: 'text-yellow-400', bg: 'bg-yellow-900', icon: AlertTriangle },
  3: { label: '绑定失败', color: 'text-red-400',    bg: 'bg-red-900',   icon: XCircle },
}

export default function SettingsPage() {
  const [bindStatus, setBindStatus]       = useState<BindStatus | null>(null)
  const [appKey, setAppKey]               = useState('')
  const [appSecret, setAppSecret]         = useState('')
  const [showSecret, setShowSecret]       = useState(false)
  const [loading, setLoading]             = useState(false)
  const [syncing, setSyncing]             = useState(false)
  const [unbinding, setUnbinding]         = useState(false)
  const [error, setError]                 = useState('')
  const [success, setSuccess]             = useState('')
  const [syncResult, setSyncResult]       = useState<SyncResult | null>(null)
  const [activeTab, setActiveTab]         = useState<'bind' | 'guide'>('bind')

  // 获取绑定状态
  const fetchStatus = useCallback(async () => {
    try {
      const res = await fetch('/api/lingxing/bind')
      const data = await res.json()
      setBindStatus(data)
    } catch {
      setBindStatus({ bound: false })
    }
  }, [])

  useEffect(() => { fetchStatus() }, [fetchStatus])

  // 提交绑定
  const handleBind = async () => {
    setError('')
    setSuccess('')
    if (!appKey.trim() || !appSecret.trim()) {
      setError('AppKey 和 AppSecret 均不能为空')
      return
    }
    setLoading(true)
    try {
      const res = await fetch('/api/lingxing/bind', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ appKey: appKey.trim(), appSecret: appSecret.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || '绑定失败')
      } else {
        setSuccess(data.message)
        setAppKey('')
        setAppSecret('')
        await fetchStatus()
      }
    } catch {
      setError('网络错误，请重试')
    } finally {
      setLoading(false)
    }
  }

  // 手动同步
  const handleSync = async () => {
    setSyncing(true)
    setSyncResult(null)
    try {
      const res = await fetch('/api/lingxing/sync', { method: 'POST' })
      const data = await res.json()
      setSyncResult(data)
      if (data.success) await fetchStatus()
    } catch {
      setSyncResult({ success: false, message: '同步请求失败，请检查网络' })
    } finally {
      setSyncing(false)
    }
  }

  // 解绑
  const handleUnbind = async () => {
    if (!confirm('确认解绑领星账号？解绑后将停止自动同步数据。')) return
    setUnbinding(true)
    try {
      const res = await fetch('/api/lingxing/bind', { method: 'DELETE' })
      const data = await res.json()
      if (data.success) {
        setSuccess('已成功解绑领星账号')
        await fetchStatus()
      } else {
        setError(data.error)
      }
    } catch {
      setError('解绑失败，请重试')
    } finally {
      setUnbinding(false)
    }
  }

  const status = bindStatus
  const authInfo = AUTH_STATUS[status?.authStatus ?? 0]
  const StatusIcon = authInfo.icon

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0f1117',
      color: '#e2e8f0',
      fontFamily: "'Noto Sans SC', sans-serif",
      padding: '32px',
    }}>
      {/* 页面标题 */}
      <div style={{ marginBottom: '28px' }}>
        <h1 style={{ fontSize: '22px', fontWeight: 700, marginBottom: '6px' }}>
          系统设置
        </h1>
        <p style={{ fontSize: '13px', color: '#64748b' }}>
          管理领星WMS账号绑定、数据同步配置
        </p>
      </div>

      <div style={{ display: 'flex', gap: '24px', maxWidth: '1000px' }}>

        {/* 左侧：绑定表单 */}
        <div style={{ flex: 1 }}>

          {/* 当前绑定状态卡片 */}
          <div style={{
            background: '#1c2333',
            border: '1px solid #2a3250',
            borderRadius: '14px',
            padding: '20px 24px',
            marginBottom: '20px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
              <div style={{
                width: '44px', height: '44px', borderRadius: '12px',
                background: status?.bound ? '#14532d44' : '#1e293b',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Database size={22} color={status?.bound ? '#22c55e' : '#64748b'} />
              </div>
              <div>
                <div style={{ fontSize: '15px', fontWeight: 700 }}>领星 WMS 账号</div>
                <div style={{ fontSize: '12px', color: '#64748b', marginTop: '2px' }}>
                  绑定后自动拉取入库/出库/库存/退件数据生成待办
                </div>
              </div>
              <div style={{ marginLeft: 'auto' }}>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: '5px',
                  padding: '4px 12px', borderRadius: '20px', fontSize: '12px', fontWeight: 600,
                  background: status?.bound ? '#14532d44' : '#1e293b',
                  color: status?.bound ? '#22c55e' : '#64748b',
                  border: `1px solid ${status?.bound ? '#16a34a44' : '#2a3250'}`,
                }}>
                  <StatusIcon size={12} />
                  {authInfo.label}
                </span>
              </div>
            </div>

            {status?.bound && (
              <div style={{
                display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
                gap: '12px', marginBottom: '16px',
              }}>
                {[
                  { label: '授权仓库', value: `${status.warehouseCount ?? 0} 个`, icon: Warehouse },
                  {
                    label: '最后同步',
                    value: status.lastSyncAt
                      ? new Date(status.lastSyncAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '从未同步',
                    icon: Clock,
                  },
                  {
                    label: 'Token到期',
                    value: status.tokenExpireAt
                      ? new Date(status.tokenExpireAt).toLocaleString('zh-CN', { month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
                      : '未知',
                    icon: CheckCircle,
                  },
                ].map(({ label, value, icon: Icon }) => (
                  <div key={label} style={{
                    background: '#0f1117', borderRadius: '8px', padding: '10px 14px',
                    border: '1px solid #2a3250',
                  }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <Icon size={12} color="#64748b" />
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{label}</span>
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 600 }}>{value}</div>
                  </div>
                ))}
              </div>
            )}

            {/* 操作按钮 */}
            {status?.bound ? (
              <div style={{ display: 'flex', gap: '10px' }}>
                <button
                  onClick={handleSync}
                  disabled={syncing}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '9px 18px', borderRadius: '8px', border: 'none',
                    background: syncing ? '#1e293b' : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                    color: 'white', fontSize: '13px', fontWeight: 600,
                    cursor: syncing ? 'not-allowed' : 'pointer',
                    boxShadow: syncing ? 'none' : '0 0 14px #3b82f633',
                    transition: 'all .2s',
                  }}
                >
                  {syncing
                    ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> 同步中...</>
                    : <><Play size={14} /> 立即同步</>
                  }
                </button>
                <button
                  onClick={handleUnbind}
                  disabled={unbinding}
                  style={{
                    display: 'flex', alignItems: 'center', gap: '7px',
                    padding: '9px 18px', borderRadius: '8px',
                    border: '1px solid #7f1d1d44', background: '#7f1d1d11',
                    color: '#ef4444', fontSize: '13px', cursor: 'pointer',
                    transition: 'all .2s',
                  }}
                >
                  <Unlink size={14} /> 解绑账号
                </button>
              </div>
            ) : null}
          </div>

          {/* Tab 切换 */}
          <div style={{
            display: 'flex', gap: '4px', marginBottom: '16px',
            background: '#1c2333', padding: '4px', borderRadius: '10px',
            border: '1px solid #2a3250',
          }}>
            {[
              { key: 'bind', label: status?.bound ? '更新绑定' : '绑定账号' },
              { key: 'guide', label: '如何获取 AppKey？' },
            ].map(tab => (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key as 'bind' | 'guide')}
                style={{
                  flex: 1, padding: '8px', borderRadius: '7px', border: 'none',
                  background: activeTab === tab.key ? '#222840' : 'transparent',
                  color: activeTab === tab.key ? '#3b82f6' : '#64748b',
                  fontSize: '13px', fontWeight: activeTab === tab.key ? 600 : 400,
                  cursor: 'pointer', transition: 'all .2s',
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'bind' && (
            <div style={{
              background: '#1c2333',
              border: '1px solid #2a3250',
              borderRadius: '14px',
              padding: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Link size={16} color="#3b82f6" />
                <span style={{ fontSize: '14px', fontWeight: 700 }}>
                  {status?.bound ? '重新配置 API 凭证' : '填写 API 凭证'}
                </span>
              </div>

              {/* AppKey 输入 */}
              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                  AppKey <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  type="text"
                  value={appKey}
                  onChange={e => setAppKey(e.target.value)}
                  placeholder="请输入领星开放平台的 AppKey"
                  style={{
                    width: '100%', padding: '11px 14px', borderRadius: '8px',
                    background: '#0f1117', border: '1px solid #2a3250',
                    color: '#e2e8f0', fontSize: '13px', outline: 'none',
                    fontFamily: 'JetBrains Mono, monospace',
                    transition: 'border-color .2s',
                    boxSizing: 'border-box',
                  }}
                  onFocus={e => e.target.style.borderColor = '#3b82f6'}
                  onBlur={e => e.target.style.borderColor = '#2a3250'}
                />
              </div>

              {/* AppSecret 输入 */}
              <div style={{ marginBottom: '20px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 600, color: '#94a3b8', marginBottom: '8px' }}>
                  AppSecret <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative' }}>
                  <input
                    type={showSecret ? 'text' : 'password'}
                    value={appSecret}
                    onChange={e => setAppSecret(e.target.value)}
                    placeholder="请输入领星开放平台的 AppSecret"
                    style={{
                      width: '100%', padding: '11px 44px 11px 14px', borderRadius: '8px',
                      background: '#0f1117', border: '1px solid #2a3250',
                      color: '#e2e8f0', fontSize: '13px', outline: 'none',
                      fontFamily: 'JetBrains Mono, monospace',
                      transition: 'border-color .2s',
                      boxSizing: 'border-box',
                    }}
                    onFocus={e => e.target.style.borderColor = '#3b82f6'}
                    onBlur={e => e.target.style.borderColor = '#2a3250'}
                  />
                  <button
                    onClick={() => setShowSecret(!showSecret)}
                    style={{
                      position: 'absolute', right: '12px', top: '50%',
                      transform: 'translateY(-50%)', background: 'none',
                      border: 'none', cursor: 'pointer', color: '#64748b',
                      display: 'flex', alignItems: 'center',
                    }}
                  >
                    {showSecret ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                <p style={{ fontSize: '11px', color: '#64748b', marginTop: '6px' }}>
                  🔒 AppSecret 将使用 AES-256 加密存储，不会明文保存
                </p>
              </div>

              {/* 错误/成功提示 */}
              {error && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                  background: '#7f1d1d22', border: '1px solid #7f1d1d44', color: '#ef4444',
                  fontSize: '13px',
                }}>
                  <AlertTriangle size={14} /> {error}
                </div>
              )}

              {success && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: '8px',
                  padding: '10px 14px', borderRadius: '8px', marginBottom: '16px',
                  background: '#14532d22', border: '1px solid #14532d44', color: '#22c55e',
                  fontSize: '13px',
                }}>
                  <CheckCircle size={14} /> {success}
                </div>
              )}

              {/* 同步结果 */}
              {syncResult && (
                <div style={{
                  padding: '12px 14px', borderRadius: '8px', marginBottom: '16px',
                  background: syncResult.success ? '#14532d22' : '#7f1d1d22',
                  border: `1px solid ${syncResult.success ? '#14532d44' : '#7f1d1d44'}`,
                  color: syncResult.success ? '#22c55e' : '#ef4444',
                  fontSize: '13px',
                }}>
                  <div style={{ fontWeight: 600, marginBottom: '4px' }}>{syncResult.message}</div>
                  {syncResult.success && (
                    <div style={{ fontSize: '12px', color: '#94a3b8' }}>
                      耗时 {syncResult.duration} · 新建 {syncResult.todosCreated} 个待办 · 更新 {syncResult.todosUpdated} 个
                    </div>
                  )}
                </div>
              )}

              <button
                onClick={handleBind}
                disabled={loading}
                style={{
                  width: '100%', padding: '12px', borderRadius: '10px', border: 'none',
                  background: loading
                    ? '#1e293b'
                    : 'linear-gradient(135deg, #3b82f6, #2563eb)',
                  color: 'white', fontSize: '14px', fontWeight: 700,
                  cursor: loading ? 'not-allowed' : 'pointer',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px',
                  boxShadow: loading ? 'none' : '0 0 20px #3b82f644',
                  transition: 'all .2s',
                }}
              >
                {loading
                  ? <><Loader2 size={16} style={{ animation: 'spin 1s linear infinite' }} /> 验证中，请稍候...</>
                  : <><Link size={16} /> {status?.bound ? '更新绑定' : '验证并绑定'}</>
                }
              </button>
            </div>
          )}

          {activeTab === 'guide' && (
            <div style={{
              background: '#1c2333',
              border: '1px solid #2a3250',
              borderRadius: '14px',
              padding: '24px',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
                <Info size={16} color="#06b6d4" />
                <span style={{ fontSize: '14px', fontWeight: 700 }}>如何获取 AppKey 和 AppSecret</span>
              </div>

              {[
                {
                  step: '1',
                  title: '登录领星 WMS 管理后台',
                  desc: '使用管理员账号登录您的领星 WMS 系统（OMP端）',
                  color: '#3b82f6',
                },
                {
                  step: '2',
                  title: '进入开放平台设置',
                  desc: '导航路径：设置 → 开放平台 → 应用管理',
                  color: '#06b6d4',
                },
                {
                  step: '3',
                  title: '创建新应用',
                  desc: '点击「创建应用」，填写应用名称（如：WMS待办系统），选择所需的 API 权限范围：入库、出库、库存、退货、工单',
                  color: '#8b5cf6',
                },
                {
                  step: '4',
                  title: '配置回调地址',
                  desc: '回调地址填写您的系统域名，如：https://your-app.vercel.app',
                  color: '#f97316',
                },
                {
                  step: '5',
                  title: '复制 AppKey 和 AppSecret',
                  desc: '创建成功后，复制页面显示的 AppKey 和 AppSecret，粘贴到左侧绑定表单中',
                  color: '#22c55e',
                },
              ].map(({ step, title, desc, color }) => (
                <div key={step} style={{
                  display: 'flex', gap: '14px', marginBottom: '16px',
                  paddingBottom: '16px',
                  borderBottom: step === '5' ? 'none' : '1px solid #2a3250',
                }}>
                  <div style={{
                    width: '28px', height: '28px', borderRadius: '50%', flexShrink: 0,
                    background: `${color}22`, border: `1px solid ${color}44`,
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontSize: '12px', fontWeight: 700, color,
                  }}>
                    {step}
                  </div>
                  <div>
                    <div style={{ fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>{title}</div>
                    <div style={{ fontSize: '12px', color: '#94a3b8', lineHeight: '1.6' }}>{desc}</div>
                  </div>
                </div>
              ))}

              <div style={{
                background: '#0f2744', border: '1px solid #1d4ed844',
                borderRadius: '8px', padding: '12px 14px', marginTop: '4px',
              }}>
                <div style={{ fontSize: '12px', color: '#93c5fd', display: 'flex', gap: '8px' }}>
                  <span>💡</span>
                  <span>
                    如果在领星后台找不到「开放平台」菜单，请联系领星客服开通 API 权限（部分套餐需要单独申请）
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* 右侧：数据同步说明 */}
        <div style={{ width: '280px', flexShrink: 0 }}>
          <div style={{
            background: '#1c2333', border: '1px solid #2a3250',
            borderRadius: '14px', padding: '20px', marginBottom: '16px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '14px', color: '#94a3b8' }}>
              📡 自动同步数据
            </div>
            {[
              { icon: '📦', label: '待入库单',     desc: '已预报，未到货' },
              { icon: '🔼', label: '待上架单',     desc: '已收货，未上架' },
              { icon: '🚚', label: '一件代发',     desc: '待处理出库单' },
              { icon: '🏭', label: '送仓出库',     desc: 'FBA/中转出库' },
              { icon: '📊', label: '库存预警',     desc: 'SKU低于预警值' },
              { icon: '↩',  label: '退件处理',     desc: '待处理退货单' },
              { icon: '📋', label: '工单审批',     desc: '待审核工单' },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 0', borderBottom: '1px solid #2a325033',
              }}>
                <span style={{ fontSize: '16px', width: '22px', textAlign: 'center' }}>{icon}</span>
                <div>
                  <div style={{ fontSize: '12px', fontWeight: 600 }}>{label}</div>
                  <div style={{ fontSize: '11px', color: '#64748b' }}>{desc}</div>
                </div>
                <CheckCircle size={12} color="#22c55e" style={{ marginLeft: 'auto', flexShrink: 0 }} />
              </div>
            ))}
          </div>

          <div style={{
            background: '#1c2333', border: '1px solid #2a3250',
            borderRadius: '14px', padding: '20px',
          }}>
            <div style={{ fontSize: '13px', fontWeight: 700, marginBottom: '12px', color: '#94a3b8' }}>
              ⏱️ 同步频率
            </div>
            <div style={{ fontSize: '13px', marginBottom: '8px' }}>
              <span style={{ color: '#3b82f6', fontWeight: 600 }}>自动同步</span>
              <span style={{ color: '#64748b', fontSize: '12px', marginLeft: '6px' }}>每 15 分钟</span>
            </div>
            <div style={{ fontSize: '12px', color: '#64748b', lineHeight: '1.7' }}>
              绑定后后台自动定时拉取领星数据，无需手动操作。<br />
              也可点击「立即同步」手动触发。
            </div>
            <div style={{
              marginTop: '12px', padding: '10px', borderRadius: '6px',
              background: '#0f1117', border: '1px solid #2a3250',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <RefreshCw size={11} color="#3b82f6" />
                <span style={{ fontSize: '11px', color: '#3b82f6', fontWeight: 600 }}>幂等处理</span>
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', lineHeight: '1.6' }}>
                同一单号不会重复生成待办，已完成的待办不会被重新激活
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
      `}</style>
    </div>
  )
}
