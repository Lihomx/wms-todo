'use client'
import { useState, useEffect } from 'react'

export default function ClientSettings() {
  const [customerCode, setCustomerCode] = useState('')
  const [clientId,     setClientId]     = useState('')
  const [authStatus,   setAuthStatus]   = useState(0)
  const [appKey,       setAppKey]       = useState('')
  const [appSecret,    setAppSecret]    = useState('')
  const [showPwd,      setShowPwd]      = useState(false)
  const [saving,       setSaving]       = useState(false)
  const [msg,          setMsg]          = useState<{text:string;ok:boolean}|null>(null)
  const [lastSync,     setLastSync]     = useState('')

  useEffect(()=>{
    fetch('/api/auth-info').then(r=>r.json()).then(async info=>{
      setCustomerCode(info.customerCode||'')
      if(!info.customerCode) return
      const r = await fetch('/api/oms-clients')
      const d = await r.json()
      const client = (d.clients||[]).find((c:any)=>c.customer_code===info.customerCode)
      if(client){ setClientId(client.id); setAuthStatus(client.auth_status||0); setLastSync(client.last_synced_at||'') }
    })
  },[])

  const save = async()=>{
    if(!appKey||!appSecret){ setMsg({text:'请填写AppKey和AppSecret',ok:false}); return }
    setSaving(true); setMsg(null)
    const r = await fetch('/api/oms-clients/bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,appKey:appKey.trim(),appSecret:appSecret.trim()})})
    const d = await r.json()
    setMsg({text:d.error?`❌ ${d.error}`:`✅ ${d.message}`,ok:!d.error})
    if(!d.error){ setAppKey(''); setAppSecret(''); setAuthStatus(1) }
    setSaving(false)
  }

  const inp:React.CSSProperties={width:'100%',padding:'9px 12px',borderRadius:'7px',background:'#f8fafc',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}
  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'20px',marginBottom:'14px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{maxWidth:'580px'}}>
        <div style={{marginBottom:'22px'}}>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>系统设置</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>客户 {customerCode} 的API凭证管理</p>
        </div>
        <div style={card}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'16px'}}>
            <div style={{fontSize:'14px',fontWeight:600,color:'#0f172a'}}>领星 OMS API 凭证</div>
            <span style={{padding:'3px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:authStatus===1?'#dcfce7':'#f1f5f9',color:authStatus===1?'#16a34a':'#64748b',border:`1px solid ${authStatus===1?'#bbf7d0':'#e2e8f0'}`}}>
              {authStatus===1?'✓ 已绑定':'未绑定'}
            </span>
          </div>
          {lastSync&&<div style={{fontSize:'12px',color:'#94a3b8',marginBottom:'14px'}}>上次同步：{new Date(lastSync).toLocaleString('zh-CN')}</div>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>AppKey</label><input value={appKey} onChange={e=>setAppKey(e.target.value)} placeholder="32位AppKey" style={inp}/></div>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>AppSecret</label>
              <div style={{position:'relative'}}>
                <input type={showPwd?'text':'password'} value={appSecret} onChange={e=>setAppSecret(e.target.value)} placeholder="AppSecret" style={{...inp,paddingRight:'40px'}}/>
                <button onClick={()=>setShowPwd(s=>!s)} style={{position:'absolute',right:'8px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'14px'}}>{showPwd?'🙈':'👁'}</button>
              </div>
            </div>
          </div>
          <div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'12px'}}>在领星OMS后台 → API信息 中获取</div>
          {msg&&<div style={{padding:'9px 12px',borderRadius:'7px',marginBottom:'10px',background:msg.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`,color:msg.ok?'#16a34a':'#dc2626',fontSize:'13px'}}>{msg.text}</div>}
          <button onClick={save} disabled={saving} style={{padding:'9px 20px',borderRadius:'7px',background:saving?'#e2e8f0':'#2563eb',border:'none',color:saving?'#94a3b8':'white',fontWeight:600,fontSize:'13px',cursor:saving?'not-allowed':'pointer'}}>
            {saving?'验证中...':'🔗 验证并绑定'}
          </button>
        </div>
      </div>
    </div>
  )
}
