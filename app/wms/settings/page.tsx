'use client'
import { useState, useEffect, useCallback } from 'react'

interface BindStatus { bound:boolean; authStatus?:number; lastSyncAt?:string; warehouseCount?:number }

export default function SettingsPage() {
  const [status,    setStatus]    = useState<BindStatus|null>(null)
  const [appKey,    setAppKey]    = useState('')
  const [appSecret, setAppSecret] = useState('')
  const [showPwd,   setShowPwd]   = useState(false)
  const [loading,   setLoading]   = useState(false)
  const [error,     setError]     = useState('')
  const [success,   setSuccess]   = useState('')

  const loadStatus = useCallback(async()=>{
    try { const r=await fetch('/api/lingxing/bind'); setStatus(await r.json()) }
    catch { setStatus({bound:false}) }
  },[])

  useEffect(()=>{ loadStatus() },[loadStatus])

  const handleBind = async()=>{
    setError(''); setSuccess('')
    if(!appKey.trim()||!appSecret.trim()){ setError('AppKey 和 AppSecret 不能为空'); return }
    setLoading(true)
    try {
      const r=await fetch('/api/lingxing/bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appKey:appKey.trim(),appSecret:appSecret.trim()})})
      const d=await r.json()
      if(!r.ok||!d.success){ setError(d.error||d.message||'绑定失败') }
      else { setSuccess(d.message); setAppKey(''); setAppSecret(''); await loadStatus() }
    } catch { setError('网络错误') }
    setLoading(false)
  }

  const inp:React.CSSProperties={width:'100%',padding:'9px 12px',borderRadius:'7px',background:'#f8fafc',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}
  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'20px',marginBottom:'14px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{maxWidth:'600px'}}>
        <div style={{marginBottom:'22px'}}>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>系统设置</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>OMS 数据同步凭证管理</p>
        </div>

        {/* Bind status */}
        <div style={card}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:status?.bound?'14px':'0'}}>
            <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
              <div style={{width:'38px',height:'38px',borderRadius:'9px',background:status?.bound?'#f0fdf4':'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>🗄️</div>
              <div>
                <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>领星 OMS 凭证</div>
                <div style={{fontSize:'12px',color:'#64748b'}}>绑定后可同步OMS数据</div>
              </div>
            </div>
            <span style={{padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:status?.bound?'#dcfce7':'#f1f5f9',color:status?.bound?'#16a34a':'#64748b',border:`1px solid ${status?.bound?'#bbf7d0':'#e2e8f0'}`}}>
              {status?.bound?'✓ 已绑定':'未绑定'}
            </span>
          </div>
          {status?.bound && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'12px',background:'#f8fafc',borderRadius:'8px',marginBottom:'14px'}}>
              <div><div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'2px'}}>仓库数量</div><div style={{fontSize:'14px',fontWeight:600,color:'#0f172a'}}>{status.warehouseCount??0} 个</div></div>
              <div><div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'2px'}}>最后同步</div><div style={{fontSize:'12px',color:'#475569'}}>{status.lastSyncAt?new Date(status.lastSyncAt).toLocaleString('zh-CN'):'从未'}</div></div>
            </div>
          )}
          <div style={{borderTop:status?.bound?'1px solid #f1f5f9':'none',paddingTop:status?.bound?'14px':'0'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'10px'}}>{status?.bound?'更新凭证':'绑定凭证'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
              <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>AppKey</label><input value={appKey} onChange={e=>setAppKey(e.target.value)} placeholder="32位AppKey" style={inp}/></div>
              <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>AppSecret</label>
                <div style={{position:'relative'}}>
                  <input type={showPwd?'text':'password'} value={appSecret} onChange={e=>setAppSecret(e.target.value)} placeholder="AppSecret" style={{...inp,paddingRight:'40px'}}/>
                  <button onClick={()=>setShowPwd(s=>!s)} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'14px'}}>{showPwd?'🙈':'👁'}</button>
                </div>
              </div>
            </div>
            {error   && <div style={{padding:'9px 12px',borderRadius:'7px',marginBottom:'10px',background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',fontSize:'13px'}}>⚠️ {error}</div>}
            {success && <div style={{padding:'9px 12px',borderRadius:'7px',marginBottom:'10px',background:'#f0fdf4',border:'1px solid #bbf7d0',color:'#16a34a',fontSize:'13px'}}>✅ {success}</div>}
            <button onClick={handleBind} disabled={loading} style={{padding:'9px 20px',borderRadius:'7px',background:loading?'#e2e8f0':'#2563eb',border:'none',color:loading?'#94a3b8':'white',fontWeight:600,fontSize:'13px',cursor:loading?'not-allowed':'pointer'}}>
              {loading?'验证中...':'🔗 验证并保存'}
            </button>
          </div>
        </div>

        <div style={{padding:'14px 16px',background:'#eff6ff',borderRadius:'8px',border:'1px solid #bfdbfe',fontSize:'12px',color:'#1d4ed8'}}>
          <strong>ℹ️ 说明：</strong> 此处凭证用于 OMS 客户端视图数据同步。各客户的独立凭证请在「仓库管理端 → 客户管理」中设置。
        </div>
      </div>
    </div>
  )
}
