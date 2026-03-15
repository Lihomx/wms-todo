'use client'
import { useState, useEffect } from 'react'

export default function WarehouseSettings() {
  const [bindStatus, setBindStatus] = useState<any>(null)
  const [form, setForm] = useState({appKey:'',appSecret:''})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState<{text:string;ok:boolean}|null>(null)
  const [showPwd, setShowPwd] = useState(false)

  useEffect(()=>{
    fetch('/api/lingxing/bind').then(r=>r.json()).then(setBindStatus)
  },[])

  const save = async () => {
    if(!form.appKey||!form.appSecret){ setMsg({text:'请填写完整',ok:false}); return }
    setSaving(true); setMsg(null)
    const r = await fetch('/api/lingxing/bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({appKey:form.appKey.trim(),appSecret:form.appSecret.trim()})})
    const d = await r.json()
    setMsg({text:d.error?`❌ ${d.error}`:`✅ ${d.message}`,ok:!d.error})
    if(!d.error){ setForm({appKey:'',appSecret:''}); fetch('/api/lingxing/bind').then(r=>r.json()).then(setBindStatus) }
    setSaving(false)
  }

  const card:React.CSSProperties = {background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'20px',marginBottom:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}
  const inp:React.CSSProperties = {width:'100%',padding:'9px 12px',borderRadius:'7px',background:'#f8fafc',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}
  const label:React.CSSProperties = {display:'block',fontSize:'12px',fontWeight:600,color:'#475569',marginBottom:'5px'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{maxWidth:'680px'}}>
        <div style={{marginBottom:'24px'}}>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>系统设置</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'4px'}}>仓库API凭证管理</p>
        </div>

        {/* Warehouse bind status */}
        <div style={card}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:bindStatus?.bound?'16px':'0'}}>
            <div style={{display:'flex',alignItems:'center',gap:'12px'}}>
              <div style={{width:'40px',height:'40px',borderRadius:'10px',background:bindStatus?.bound?'#f0fdf4':'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px'}}>🗄️</div>
              <div>
                <div style={{fontSize:'14px',fontWeight:600,color:'#0f172a'}}>仓库 OMS 凭证</div>
                <div style={{fontSize:'12px',color:'#64748b'}}>用于拉取仓库基础数据（仓库列表等）</div>
              </div>
            </div>
            <span style={{padding:'4px 10px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:bindStatus?.bound?'#dcfce7':'#f1f5f9',color:bindStatus?.bound?'#16a34a':'#64748b',border:`1px solid ${bindStatus?.bound?'#bbf7d0':'#e2e8f0'}`}}>
              {bindStatus?.bound?'✓ 已绑定':'未绑定'}
            </span>
          </div>
          {bindStatus?.bound && (
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',padding:'12px',background:'#f8fafc',borderRadius:'8px',marginBottom:'16px'}}>
              <div><div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'2px'}}>仓库数量</div><div style={{fontSize:'14px',fontWeight:600,color:'#0f172a'}}>{bindStatus.warehouseCount ?? 0} 个</div></div>
              <div><div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'2px'}}>最后同步</div><div style={{fontSize:'13px',color:'#475569'}}>{bindStatus.lastSyncAt?new Date(bindStatus.lastSyncAt).toLocaleString('zh-CN'):'从未'}</div></div>
            </div>
          )}
          {/* Bind form */}
          <div style={{borderTop:'1px solid #f1f5f9',paddingTop:'16px',marginTop: bindStatus?.bound?'0':'0'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'12px'}}>{bindStatus?.bound?'更新凭证':'绑定凭证'}</div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
              <div><label style={label}>AppKey</label><input value={form.appKey} onChange={e=>setForm(f=>({...f,appKey:e.target.value}))} placeholder="32位 AppKey" style={inp}/></div>
              <div><label style={label}>AppSecret</label>
                <div style={{position:'relative'}}>
                  <input type={showPwd?'text':'password'} value={form.appSecret} onChange={e=>setForm(f=>({...f,appSecret:e.target.value}))} placeholder="AppSecret" style={{...inp,paddingRight:'40px'}}/>
                  <button onClick={()=>setShowPwd(s=>!s)} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'14px'}}>{showPwd?'🙈':'👁'}</button>
                </div>
              </div>
            </div>
            {msg && <div style={{padding:'9px 12px',borderRadius:'7px',marginBottom:'10px',background:msg.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`,color:msg.ok?'#16a34a':'#dc2626',fontSize:'13px'}}>{msg.text}</div>}
            <button onClick={save} disabled={saving} style={{padding:'9px 20px',borderRadius:'7px',background:saving?'#e2e8f0':'#2563eb',border:'none',color:saving?'#94a3b8':'white',fontWeight:600,fontSize:'13px',cursor:saving?'not-allowed':'pointer'}}>
              {saving?'验证中...':'🔗 验证并保存'}
            </button>
          </div>
        </div>

        {/* Info */}
        <div style={{padding:'14px 16px',background:'#eff6ff',borderRadius:'8px',border:'1px solid #bfdbfe',fontSize:'12px',color:'#1d4ed8'}}>
          <div style={{fontWeight:600,marginBottom:'4px'}}>ℹ️ 说明</div>
          <div style={{lineHeight:1.7,color:'#3b82f6'}}>
            仓库凭证用于访问仓库级别接口（仓库列表）。各OMS客户的入库/出库/库存数据请在「客户管理」页面为每个客户单独绑定其AppKey。
          </div>
        </div>
      </div>
    </div>
  )
}
