'use client'
import { useState, useEffect } from 'react'

interface Client {
  id: string; customer_code: string; customer_name: string
  oms_account: string; company_name: string; status: string
  auth_status: number; last_synced_at: string|null; sync_enabled: boolean
  todo_count?: number
}

const AUTH_LABEL = ['未绑定','已绑定','验证失败']
const AUTH_COLOR = ['#64748b','#22c55e','#ef4444']

export default function ClientsPage() {
  const [clients,  setClients]  = useState<Client[]>([])
  const [loading,  setLoading]  = useState(true)
  const [bindingId,setBindingId]= useState<string|null>(null)
  const [form,     setForm]     = useState({appKey:'',appSecret:''})
  const [syncing,  setSyncing]  = useState<string|null>(null)
  const [msg,      setMsg]      = useState<{text:string;ok:boolean}|null>(null)
  const [showAdd,  setShowAdd]  = useState(false)
  const [newClient,setNewClient]= useState({customer_code:'',customer_name:'',oms_account:'',company_name:''})

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/oms-clients'); const d = await r.json()
    setClients(d.clients ?? []); setLoading(false)
  }

  const bindClient = async (clientId: string) => {
    if(!form.appKey||!form.appSecret){ setMsg({text:'请填写AppKey和AppSecret',ok:false}); return }
    setMsg(null)
    const r = await fetch('/api/oms-clients/bind', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({clientId, appKey:form.appKey.trim(), appSecret:form.appSecret.trim()})
    })
    const d = await r.json()
    setMsg({text: d.error ? `❌ ${d.error}` : `✅ ${d.message}`, ok: !d.error})
    if(!d.error){ setBindingId(null); setForm({appKey:'',appSecret:''}); await load() }
  }

  const syncClient = async (clientId: string, customerCode: string) => {
    setSyncing(clientId); setMsg(null)
    const r = await fetch('/api/oms-clients/sync-data', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({clientId, customerCode})
    })
    const d = await r.json()
    setMsg({text: d.error ? `❌ ${d.error}` : `✅ ${d.message}`, ok: !d.error})
    setSyncing(null); await load()
  }

  const addClient = async () => {
    if(!newClient.customer_code||!newClient.customer_name){ setMsg({text:'客户代码和名称必填',ok:false}); return }
    const r = await fetch('/api/oms-clients', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(newClient)})
    const d = await r.json()
    if(d.error){ setMsg({text:`❌ ${d.error}`,ok:false}) } else { setShowAdd(false); setNewClient({customer_code:'',customer_name:'',oms_account:'',company_name:''}); await load() }
  }

  useEffect(()=>{load()},[])

  const inp:React.CSSProperties={width:'100%',padding:'9px 12px',borderRadius:'7px',background:'#0f1117',border:'1px solid #2a3250',color:'#e2e8f0',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#0d1117',padding:'28px 24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:800,color:'#f1f5f9'}}>OMS 客户管理</h1>
          <p style={{fontSize:'12px',color:'#475569',marginTop:'4px'}}>为每个客户绑定AppKey后可同步其单据数据</p>
        </div>
        <button onClick={()=>setShowAdd(s=>!s)} style={{padding:'8px 16px',borderRadius:'7px',background:'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
          + 新增客户
        </button>
      </div>

      {msg && (
        <div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:msg.ok?'#22c55e15':'#ef444415',border:`1px solid ${msg.ok?'#22c55e33':'#ef444433'}`,color:msg.ok?'#22c55e':'#ef4444',fontSize:'13px'}}>
          {msg.text}
        </div>
      )}

      {/* Add client form */}
      {showAdd && (
        <div style={{background:'#161b26',border:'1px solid #3b82f644',borderRadius:'12px',padding:'18px',marginBottom:'18px'}}>
          <div style={{fontSize:'13px',fontWeight:700,color:'#f1f5f9',marginBottom:'14px'}}>新增OMS客户</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
            <div><label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'4px'}}>客户代码 *</label><input value={newClient.customer_code} onChange={e=>setNewClient(n=>({...n,customer_code:e.target.value}))} placeholder="如：5629031" style={inp}/></div>
            <div><label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'4px'}}>客户名称 *</label><input value={newClient.customer_name} onChange={e=>setNewClient(n=>({...n,customer_name:e.target.value}))} placeholder="如：A53 AN安蒂斯科技" style={inp}/></div>
            <div><label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'4px'}}>OMS账号</label><input value={newClient.oms_account} onChange={e=>setNewClient(n=>({...n,oms_account:e.target.value}))} placeholder="如：MelissaA53" style={inp}/></div>
            <div><label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'4px'}}>公司名称</label><input value={newClient.company_name} onChange={e=>setNewClient(n=>({...n,company_name:e.target.value}))} placeholder="公司名称（可选）" style={inp}/></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={addClient} style={{padding:'8px 18px',borderRadius:'7px',background:'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>确认添加</button>
            <button onClick={()=>setShowAdd(false)} style={{padding:'8px 14px',borderRadius:'7px',border:'1px solid #2a3250',background:'transparent',color:'#64748b',cursor:'pointer',fontSize:'13px'}}>取消</button>
          </div>
        </div>
      )}

      {/* Client list */}
      <div style={{display:'flex',flexDirection:'column' as const,gap:'12px'}}>
        {loading ? <div style={{padding:'40px',textAlign:'center' as const,color:'#475569'}}>加载中...</div>
        : clients.length===0 ? (
          <div style={{padding:'40px',textAlign:'center' as const,background:'#161b26',borderRadius:'12px',border:'1px solid #2a3250'}}>
            <div style={{color:'#475569',fontSize:'13px',marginBottom:'12px'}}>暂无客户，点击「新增客户」手动添加</div>
          </div>
        ) : clients.map(c=>(
          <div key={c.id} style={{background:'#161b26',border:`1px solid ${c.auth_status===1?'#22c55e33':'#2a3250'}`,borderRadius:'12px',padding:'18px',transition:'border-color 0.2s'}}>
            <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'12px'}}>
              <div style={{flex:1}}>
                <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'5px'}}>
                  <span style={{fontSize:'15px',fontWeight:800,color:'#f1f5f9'}}>{c.customer_name}</span>
                  <span style={{fontSize:'11px',color:'#64748b'}}>{c.customer_code}</span>
                  <span style={{padding:'2px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:700,background:`${AUTH_COLOR[c.auth_status??0]}22`,color:AUTH_COLOR[c.auth_status??0]}}>
                    {AUTH_LABEL[c.auth_status??0]}
                  </span>
                </div>
                {c.oms_account && <div style={{fontSize:'12px',color:'#64748b'}}>OMS账号：{c.oms_account}{c.company_name?` · ${c.company_name}`:''}</div>}
                {c.last_synced_at && <div style={{fontSize:'11px',color:'#475569',marginTop:'3px'}}>上次同步：{new Date(c.last_synced_at).toLocaleString('zh-CN')}</div>}
              </div>
              <div style={{display:'flex',gap:'7px',flexShrink:0}}>
                <button onClick={()=>window.open('https://oms.xlwms.com','_blank')} style={{padding:'6px 12px',borderRadius:'6px',border:'1px solid #3b82f633',background:'#1e3a5f',color:'#3b82f6',cursor:'pointer',fontSize:'12px',fontWeight:600,whiteSpace:'nowrap' as const}}>
                  🔗 OMS登录
                </button>
                {c.auth_status===1 && (
                  <button onClick={()=>syncClient(c.id,c.customer_code)} disabled={syncing===c.id} style={{padding:'6px 12px',borderRadius:'6px',border:'1px solid #22c55e33',background:'#14532d22',color:'#22c55e',cursor:syncing===c.id?'not-allowed':'pointer',fontSize:'12px',fontWeight:600}}>
                    {syncing===c.id?'⟳':'⟳'} 同步数据
                  </button>
                )}
                <button onClick={()=>setBindingId(bindingId===c.id?null:c.id)} style={{padding:'6px 12px',borderRadius:'6px',border:'1px solid #f9731633',background:'#f9731611',color:'#f97316',cursor:'pointer',fontSize:'12px',fontWeight:600}}>
                  {c.auth_status===1?'🔑 更新凭证':'🔑 绑定AppKey'}
                </button>
              </div>
            </div>

            {/* Bind form */}
            {bindingId===c.id && (
              <div style={{marginTop:'14px',padding:'14px',background:'#0f1117',borderRadius:'8px',border:'1px solid #2a3250'}}>
                <div style={{fontSize:'12px',fontWeight:700,color:'#f1f5f9',marginBottom:'10px'}}>
                  为 {c.customer_name} 绑定 OMS API 凭证
                </div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'10px'}}>
                  <div>
                    <label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'4px'}}>AppKey</label>
                    <input value={form.appKey} onChange={e=>setForm(f=>({...f,appKey:e.target.value}))} placeholder="32位AppKey" style={inp}/>
                  </div>
                  <div>
                    <label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'4px'}}>AppSecret</label>
                    <input type="password" value={form.appSecret} onChange={e=>setForm(f=>({...f,appSecret:e.target.value}))} placeholder="AppSecret" style={inp}/>
                  </div>
                </div>
                <div style={{fontSize:'11px',color:'#475569',marginBottom:'10px'}}>
                  在 {c.oms_account||'客户'} 的领星OMS后台 → API信息 中获取
                </div>
                <div style={{display:'flex',gap:'8px'}}>
                  <button onClick={()=>bindClient(c.id)} style={{padding:'8px 18px',borderRadius:'7px',background:'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
                    🔗 验证并绑定
                  </button>
                  <button onClick={()=>{setBindingId(null);setForm({appKey:'',appSecret:''})}} style={{padding:'8px 14px',borderRadius:'7px',border:'1px solid #2a3250',background:'transparent',color:'#64748b',cursor:'pointer',fontSize:'13px'}}>
                    取消
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
