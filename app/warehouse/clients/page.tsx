'use client'
import { useState, useEffect } from 'react'

interface Client { id:string;customer_code:string;customer_name:string;oms_account:string;company_name:string;status:string;auth_status:number;last_synced_at:string|null;sync_enabled:boolean }

export default function ClientsPage() {
  const [clients,   setClients]   = useState<Client[]>([])
  const [loading,   setLoading]   = useState(true)
  const [bindingId, setBindingId] = useState<string|null>(null)
  const [form,      setForm]      = useState({appKey:'',appSecret:''})
  const [syncing,   setSyncing]   = useState<string|null>(null)
  const [showPwd,   setShowPwd]   = useState(false)
  const [msg,       setMsg]       = useState<{text:string;ok:boolean}|null>(null)
  const [showAdd,   setShowAdd]   = useState(false)
  const [newClient, setNewClient] = useState({customer_code:'',customer_name:'',oms_account:'',company_name:''})

  const load = async()=>{ setLoading(true); const r=await fetch('/api/oms-clients'); const d=await r.json(); setClients(d.clients??[]); setLoading(false) }

  const bindClient = async(clientId:string)=>{
    if(!form.appKey||!form.appSecret){ setMsg({text:'请填写AppKey和AppSecret',ok:false}); return }
    setMsg(null)
    const r=await fetch('/api/oms-clients/bind',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId,appKey:form.appKey.trim(),appSecret:form.appSecret.trim()})})
    const d=await r.json()
    setMsg({text:d.error?`❌ ${d.error}`:`✅ ${d.message}`,ok:!d.error})
    if(!d.error){ setBindingId(null); setForm({appKey:'',appSecret:''}); await load() }
  }

  const syncClient = async(client:Client)=>{
    setSyncing(client.id); setMsg(null)
    const r=await fetch('/api/oms-clients/sync-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:client.id,customerCode:client.customer_code})})
    const d=await r.json()
    setMsg({text:d.error?`❌ ${d.error}`:`✅ ${d.message}`,ok:!d.error})
    setSyncing(null); await load()
  }

  const addClient = async()=>{
    if(!newClient.customer_code||!newClient.customer_name){ setMsg({text:'客户代码和名称必填',ok:false}); return }
    const r=await fetch('/api/oms-clients',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newClient)})
    const d=await r.json()
    if(d.error){ setMsg({text:`❌ ${d.error}`,ok:false}) } else { setShowAdd(false); setNewClient({customer_code:'',customer_name:'',oms_account:'',company_name:''}); setMsg({text:'✅ 客户添加成功',ok:true}); await load() }
  }

  useEffect(()=>{ load() },[])

  const inp:React.CSSProperties={width:'100%',padding:'9px 12px',borderRadius:'7px',background:'#f8fafc',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}
  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>OMS 客户管理</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>为每个客户绑定AppKey后可同步其单据数据</p>
        </div>
        <button onClick={()=>setShowAdd(s=>!s)} style={{padding:'9px 16px',borderRadius:'8px',background:'#2563eb',border:'none',color:'white',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>
          + 新增客户
        </button>
      </div>

      {msg && <div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:msg.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`,color:msg.ok?'#16a34a':'#dc2626',fontSize:'13px'}}>{msg.text}</div>}

      {/* Add form */}
      {showAdd && (
        <div style={{...card,padding:'20px',marginBottom:'16px',border:'1px solid #bfdbfe',background:'#f8fbff'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'14px'}}>新增OMS客户</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>客户代码 *</label><input value={newClient.customer_code} onChange={e=>setNewClient(n=>({...n,customer_code:e.target.value}))} placeholder="如：5629031" style={inp}/></div>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>客户名称 *</label><input value={newClient.customer_name} onChange={e=>setNewClient(n=>({...n,customer_name:e.target.value}))} placeholder="如：A53 AN安蒂斯科技" style={inp}/></div>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>OMS账号</label><input value={newClient.oms_account} onChange={e=>setNewClient(n=>({...n,oms_account:e.target.value}))} placeholder="如：MelissaA53" style={inp}/></div>
            <div><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>公司名称（可选）</label><input value={newClient.company_name} onChange={e=>setNewClient(n=>({...n,company_name:e.target.value}))} placeholder="公司名称" style={inp}/></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={addClient} style={{padding:'8px 18px',borderRadius:'7px',background:'#2563eb',border:'none',color:'white',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>确认添加</button>
            <button onClick={()=>setShowAdd(false)} style={{padding:'8px 14px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'white',color:'#475569',cursor:'pointer',fontSize:'13px'}}>取消</button>
          </div>
        </div>
      )}

      {/* Client list */}
      <div style={{display:'flex',flexDirection:'column' as const,gap:'10px'}}>
        {loading ? <div style={{...card,padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>加载中...</div>
        : clients.length===0 ? <div style={{...card,padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>暂无客户，点击「新增客户」添加</div>
        : clients.map(c=>(
          <div key={c.id} style={{...card,padding:'18px 20px',borderLeft:`3px solid ${c.auth_status===1?'#16a34a':'#e2e8f0'}`}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'4px'}}>
                  <span style={{fontSize:'15px',fontWeight:700,color:'#0f172a'}}>{c.customer_name}</span>
                  <span style={{fontSize:'11px',color:'#94a3b8',padding:'1px 6px',background:'#f1f5f9',borderRadius:'4px'}}>{c.customer_code}</span>
                  <span style={{fontSize:'11px',fontWeight:600,padding:'2px 7px',borderRadius:'20px',background:c.auth_status===1?'#dcfce7':'#f1f5f9',color:c.auth_status===1?'#16a34a':'#94a3b8',border:`1px solid ${c.auth_status===1?'#bbf7d0':'#e2e8f0'}`}}>
                    {c.auth_status===1?'✓ 已绑定':'未绑定'}
                  </span>
                </div>
                <div style={{fontSize:'12px',color:'#64748b'}}>
                  {c.oms_account&&`OMS账号：${c.oms_account}`}
                  {c.last_synced_at&&<span style={{marginLeft:c.oms_account?'12px':'0',color:'#94a3b8'}}>上次同步：{new Date(c.last_synced_at).toLocaleString('zh-CN')}</span>}
                </div>
              </div>
              <div style={{display:'flex',gap:'6px',flexShrink:0}}>
                <button onClick={()=>window.location.href=`/wms/dashboard?client=${c.customer_code}`} style={{padding:'7px 12px',borderRadius:'6px',border:'1px solid #bfdbfe',background:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:'12px',fontWeight:500}}>
                  进入OMS客户端
                </button>
                {c.auth_status===1 && (
                  <button onClick={()=>syncClient(c)} disabled={syncing===c.id} style={{padding:'7px 12px',borderRadius:'6px',border:'1px solid #bbf7d0',background:'#f0fdf4',color:'#16a34a',cursor:syncing===c.id?'not-allowed':'pointer',fontSize:'12px',fontWeight:500}}>
                    {syncing===c.id?'同步中...':'↻ 同步数据'}
                  </button>
                )}
                <button onClick={()=>{setBindingId(bindingId===c.id?null:c.id);setForm({appKey:'',appSecret:''}); setShowPwd(false)}} style={{padding:'7px 12px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'white',color:'#475569',cursor:'pointer',fontSize:'12px',fontWeight:500}}>
                  {c.auth_status===1?'更新凭证':'🔑 绑定AppKey'}
                </button>
              </div>
            </div>

            {/* Bind form */}
            {bindingId===c.id && (
              <div style={{marginTop:'14px',padding:'16px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'10px'}}>
                  为 {c.customer_name} 绑定 OMS API 凭证
                  <span style={{fontSize:'11px',color:'#94a3b8',fontWeight:400,marginLeft:'6px'}}>在客户的领星OMS → API信息中获取</span>
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                  <div>
                    <label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>AppKey</label>
                    <input value={form.appKey} onChange={e=>setForm(f=>({...f,appKey:e.target.value}))} placeholder="32位AppKey" style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>AppSecret</label>
                    <div style={{position:'relative'}}>
                      <input type={showPwd?'text':'password'} value={form.appSecret} onChange={e=>setForm(f=>({...f,appSecret:e.target.value}))} placeholder="AppSecret" style={{...inp,paddingRight:'40px'}}/>
                      <button onClick={()=>setShowPwd(s=>!s)} style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'14px'}}>{showPwd?'🙈':'👁'}</button>
                    </div>
                  </div>
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={()=>bindClient(c.id)} style={{padding:'8px 18px',borderRadius:'7px',background:'#2563eb',border:'none',color:'white',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>🔗 验证并绑定</button>
                  <button onClick={()=>setBindingId(null)} style={{padding:'8px 14px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'white',color:'#475569',cursor:'pointer',fontSize:'13px'}}>取消</button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
