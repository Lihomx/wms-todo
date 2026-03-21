'use client'
import { useState, useEffect } from 'react'

interface Client {
  id: string; customer_code: string; customer_name: string
  oms_account: string; company_name: string; status: string
  auth_status: number; last_synced_at: string|null
}

export default function ClientsPage() {
  const [clients,   setClients]   = useState<Client[]>([])
  const [loading,   setLoading]   = useState(true)
  const [msg,       setMsg]       = useState<{text:string;ok:boolean}|null>(null)

  // Add new client
  const [showAdd,   setShowAdd]   = useState(false)
  const [newClient, setNewClient] = useState({customer_code:'',customer_name:'',oms_account:'',company_name:''})

  // Edit basic info
  const [editingId, setEditingId] = useState<string|null>(null)
  const [editForm,  setEditForm]  = useState({customer_code:'',customer_name:'',oms_account:'',company_name:''})

  // Bind AppKey
  const [bindingId, setBindingId] = useState<string|null>(null)
  const [bindForm,  setBindForm]  = useState({appKey:'',appSecret:''})
  const [showPwd,   setShowPwd]   = useState(false)

  // Actions
  const [syncing,  setSyncing]  = useState<string|null>(null)
  const [deleting, setDeleting] = useState<string|null>(null)
  const [saving,   setSaving]   = useState(false)

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/oms-clients')
    const d = await r.json()
    setClients(d.clients ?? [])
    setLoading(false)
  }

  const showMsg = (text: string, ok: boolean) => {
    setMsg({text, ok})
    setTimeout(() => setMsg(null), 4000)
  }

  const startEdit = (c: Client) => {
    setEditingId(c.id)
    setEditForm({customer_code: c.customer_code, customer_name: c.customer_name, oms_account: c.oms_account||'', company_name: c.company_name||''})
    setBindingId(null)
  }

  const saveEdit = async (id: string) => {
    if (!editForm.customer_code || !editForm.customer_name) { showMsg('客户代码和名称必填', false); return }
    setSaving(true)
    const r = await fetch('/api/oms-clients', {
      method: 'PATCH',
      headers: {'Content-Type':'application/json'},
      body: JSON.stringify({id, ...editForm})
    })
    const d = await r.json()
    if (d.error) { showMsg(`❌ ${d.error}`, false) }
    else { showMsg('✅ 客户信息已更新', true); setEditingId(null); await load() }
    setSaving(false)
  }

  const addClient = async () => {
    if (!newClient.customer_code || !newClient.customer_name) { showMsg('客户代码和名称必填', false); return }
    const r = await fetch('/api/oms-clients', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newClient)})
    const d = await r.json()
    if (d.error) { showMsg(`❌ ${d.error}`, false) }
    else { showMsg('✅ 客户添加成功', true); setShowAdd(false); setNewClient({customer_code:'',customer_name:'',oms_account:'',company_name:''}); await load() }
  }

  const bindClient = async (clientId: string) => {
    if (!bindForm.appKey || !bindForm.appSecret) { showMsg('请填写AppKey和AppSecret', false); return }
    setSaving(true)
    const r = await fetch('/api/oms-clients/bind', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId, appKey:bindForm.appKey.trim(), appSecret:bindForm.appSecret.trim()})})
    const d = await r.json()
    if (d.error) { showMsg(`❌ ${d.error}`, false) }
    else { showMsg(`✅ ${d.message}`, true); setBindingId(null); setBindForm({appKey:'',appSecret:''}); await load() }
    setSaving(false)
  }

  const syncClient = async (client: Client) => {
    setSyncing(client.id)
    const r = await fetch('/api/oms-clients/sync-data', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:client.id,customerCode:client.customer_code})})
    const d = await r.json()
    showMsg(d.error ? `❌ ${d.error}` : `✅ ${d.message}`, !d.error)
    setSyncing(null); await load()
  }

  const deleteClient = async (client: Client) => {
    if (!window.confirm(`确认删除客户「${client.customer_name}」？\n该客户的待办数据不会删除。`)) return
    setDeleting(client.id)
    const r = await fetch(`/api/oms-clients?id=${client.id}`, {method:'DELETE'})
    const d = await r.json()
    if (d.error) { showMsg(`❌ ${d.error}`, false) }
    else { showMsg('✅ 客户已删除', true); await load() }
    setDeleting(null)
  }

  useEffect(() => { load() }, [])

  const inp: React.CSSProperties = {width:'100%',padding:'8px 10px',borderRadius:'6px',background:'#f8fafc',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}
  const card: React.CSSProperties = {background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}
  const btn = (color: string, bg: string, border: string): React.CSSProperties => ({
    padding:'7px 12px',borderRadius:'6px',border:`1px solid ${border}`,
    background:bg,color,cursor:'pointer',fontSize:'12px',fontWeight:500,whiteSpace:'nowrap' as const
  })

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>OMS 客户管理</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>为每个客户绑定AppKey后可同步其单据数据</p>
        </div>
        <button onClick={()=>{setShowAdd(s=>!s);setEditingId(null);setBindingId(null)}}
          style={{padding:'9px 16px',borderRadius:'8px',background:'#2563eb',border:'none',color:'white',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>
          + 新增客户
        </button>
      </div>

      {msg && (
        <div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:msg.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`,color:msg.ok?'#16a34a':'#dc2626',fontSize:'13px'}}>
          {msg.text}
        </div>
      )}

      {/* Add form */}
      {showAdd && (
        <div style={{...card,padding:'20px',marginBottom:'14px',border:'1px solid #bfdbfe',background:'#f8fbff'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'12px'}}>新增OMS客户</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>客户代码 *</label><input value={newClient.customer_code} onChange={e=>setNewClient(n=>({...n,customer_code:e.target.value}))} placeholder="如：5629031" style={inp}/></div>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>客户名称 *</label><input value={newClient.customer_name} onChange={e=>setNewClient(n=>({...n,customer_name:e.target.value}))} placeholder="如：A21" style={inp}/></div>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>OMS账号</label><input value={newClient.oms_account} onChange={e=>setNewClient(n=>({...n,oms_account:e.target.value}))} placeholder="如：A21-01" style={inp}/></div>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>公司名称（可选）</label><input value={newClient.company_name} onChange={e=>setNewClient(n=>({...n,company_name:e.target.value}))} placeholder="公司名称" style={inp}/></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={addClient} style={{...btn('white','#2563eb','#2563eb'),fontWeight:600}}>确认添加</button>
            <button onClick={()=>setShowAdd(false)} style={btn('#475569','white','#e2e8f0')}>取消</button>
          </div>
        </div>
      )}

      {/* Client list */}
      <div style={{display:'flex',flexDirection:'column' as const,gap:'10px'}}>
        {loading ? <div style={{...card,padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>加载中...</div>
        : clients.length===0 ? <div style={{...card,padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>暂无客户</div>
        : clients.map(c => (
          <div key={c.id} style={{...card,borderLeft:`3px solid ${c.auth_status===1?'#16a34a':'#e2e8f0'}`}}>
            <div style={{padding:'16px 18px'}}>
              <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
                <div style={{flex:1,minWidth:0}}>
                  {editingId === c.id ? (
                    /* ── Edit mode ── */
                    <div>
                      <div style={{fontSize:'12px',fontWeight:600,color:'#2563eb',marginBottom:'10px'}}>✏️ 编辑客户信息</div>
                      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'10px'}}>
                        <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>客户代码 *</label><input value={editForm.customer_code} onChange={e=>setEditForm(f=>({...f,customer_code:e.target.value}))} style={inp}/></div>
                        <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>客户名称 *</label><input value={editForm.customer_name} onChange={e=>setEditForm(f=>({...f,customer_name:e.target.value}))} style={inp}/></div>
                        <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>OMS账号</label><input value={editForm.oms_account} onChange={e=>setEditForm(f=>({...f,oms_account:e.target.value}))} style={inp}/></div>
                        <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>公司名称</label><input value={editForm.company_name} onChange={e=>setEditForm(f=>({...f,company_name:e.target.value}))} style={inp}/></div>
                      </div>
                      <div style={{display:'flex',gap:'8px'}}>
                        <button onClick={()=>saveEdit(c.id)} disabled={saving} style={{...btn('white','#2563eb','#2563eb'),fontWeight:600,opacity:saving?0.6:1}}>{saving?'保存中...':'✓ 保存'}</button>
                        <button onClick={()=>setEditingId(null)} style={btn('#475569','white','#e2e8f0')}>取消</button>
                      </div>
                    </div>
                  ) : (
                    /* ── Display mode ── */
                    <div>
                      <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px',flexWrap:'wrap' as const}}>
                        <span style={{fontSize:'15px',fontWeight:700,color:'#0f172a'}}>{c.customer_name}</span>
                        <span style={{fontSize:'11px',color:'#94a3b8',padding:'1px 6px',background:'#f1f5f9',borderRadius:'4px'}}>{c.customer_code}</span>
                        <span style={{fontSize:'11px',fontWeight:600,padding:'2px 8px',borderRadius:'20px',background:c.auth_status===1?'#dcfce7':'#f1f5f9',color:c.auth_status===1?'#16a34a':'#94a3b8',border:`1px solid ${c.auth_status===1?'#bbf7d0':'#e2e8f0'}`}}>
                          {c.auth_status===1?'✓ 已绑定':'未绑定'}
                        </span>
                      </div>
                      <div style={{fontSize:'12px',color:'#64748b'}}>
                        {c.oms_account && `OMS账号：${c.oms_account}`}
                        {c.company_name && <span style={{marginLeft:'10px'}}>{c.company_name}</span>}
                        {c.last_synced_at && <span style={{marginLeft:'10px',color:'#94a3b8'}}>上次同步：{new Date(c.last_synced_at).toLocaleString('zh-CN')}</span>}
                      </div>
                    </div>
                  )}
                </div>

                {/* Action buttons - always visible */}
                {editingId !== c.id && (
                  <div style={{display:'flex',gap:'6px',flexShrink:0,flexWrap:'wrap' as const}}>
                    <button onClick={async()=>{
                      const r = await fetch('/api/impersonate',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({customerCode:c.customer_code})})
                      const d = await r.json()
                      if(d.error){ alert('生成访问令牌失败: '+d.error); return }
                      window.open(`/client/login?token=${d.token}`, '_blank')
                    }} style={btn('#2563eb','#eff6ff','#bfdbfe')}>进入OMS客户端</button>
                    {c.auth_status===1 && (
                      <button onClick={()=>syncClient(c)} disabled={syncing===c.id} style={{...btn('#16a34a','#f0fdf4','#bbf7d0'),opacity:syncing===c.id?0.6:1}}>
                        {syncing===c.id?'同步中...':'↻ 同步数据'}
                      </button>
                    )}
                    <button onClick={()=>startEdit(c)} style={btn('#475569','#f8fafc','#e2e8f0')}>✏️ 编辑</button>
                    <button onClick={()=>{setBindingId(bindingId===c.id?null:c.id);setEditingId(null);setBindForm({appKey:'',appSecret:''});setShowPwd(false)}} style={btn('#d97706','#fffbeb','#fde68a')}>
                      {c.auth_status===1?'更新凭证':'🔑 绑定AppKey'}
                    </button>
                    <button onClick={()=>deleteClient(c)} disabled={deleting===c.id} style={{...btn('#dc2626','#fef2f2','#fecaca'),opacity:deleting===c.id?0.6:1}}>
                      {deleting===c.id?'删除中...':'🗑 删除'}
                    </button>
                  </div>
                )}
              </div>
            </div>

            {/* Bind AppKey panel */}
            {bindingId===c.id && (
              <div style={{margin:'0 18px 16px',padding:'14px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:'12px',fontWeight:600,color:'#0f172a',marginBottom:'3px'}}>为 {c.customer_name} 绑定 OMS API 凭证</div>
                <div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'10px'}}>在客户领星OMS后台 → API信息 中获取 · 每个客户必须使用唯一AppKey</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                  <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>AppKey</label><input value={bindForm.appKey} onChange={e=>setBindForm(f=>({...f,appKey:e.target.value}))} placeholder="32位AppKey" style={inp}/></div>
                  <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'3px'}}>AppSecret</label>
                    <div style={{position:'relative'}}>
                      <input type={showPwd?'text':'password'} value={bindForm.appSecret} onChange={e=>setBindForm(f=>({...f,appSecret:e.target.value}))} placeholder="AppSecret" style={{...inp,paddingRight:'38px'}}/>
                      <button onClick={()=>setShowPwd(s=>!s)} style={{position:'absolute',right:'8px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'13px'}}>{showPwd?'🙈':'👁'}</button>
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={()=>bindClient(c.id)} disabled={saving} style={{...btn('white','#2563eb','#2563eb'),fontWeight:600,opacity:saving?0.6:1}}>{saving?'验证中...':'🔗 验证并绑定'}</button>
                  <button onClick={()=>setBindingId(null)} style={btn('#475569','white','#e2e8f0')}>取消</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
