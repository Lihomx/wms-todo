'use client'
import { useState, useEffect } from 'react'

interface Client { id:string; customer_code:string; customer_name:string; auth_status:number; last_synced_at:string|null }
interface SyncResult { created:number; skipped:number; error?:string }

const SYNC_TYPES = [
  { key:'outbound',   label:'一件代发',  icon:'🚚', desc:'出库单（物流/跟踪号/收件人等）' },
  { key:'inbound',    label:'入库单',    icon:'📦', desc:'入库单状态' },
  { key:'returns',    label:'退件单',    icon:'↩️',  desc:'退件处理（每页10条）' },
  { key:'inventory',  label:'库存预警',  icon:'📊', desc:'可用库存≤10件' },
]

export default function WarehouseSyncPage() {
  const [clients,  setClients]  = useState<Client[]>([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState<string|null>(null)  // "clientId-type"
  const [results,  setResults]  = useState<Record<string,any>>({})
  const [msgs,     setMsgs]     = useState<Record<string,{text:string;ok:boolean}>>({})

  useEffect(()=>{
    fetch('/api/oms-clients').then(r=>r.json()).then(d=>{
      setClients((d.clients??[]).filter((c:Client)=>c.auth_status===1))
      setLoading(false)
    })
  },[])

  const sync = async(client:Client, syncType:string) => {
    const key = `${client.id}-${syncType}`
    setSyncing(key)
    setMsgs(m=>({...m,[key]:{text:'同步中...',ok:true}}))

    try {
      const r = await fetch('/api/oms-clients/sync-data', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({clientId:client.id, customerCode:client.customer_code, syncType})
      })
      const d = await r.json()
      const ok = !d.error
      const text = ok ? `✅ ${d.message}` : `❌ ${d.error}`
      setMsgs(m=>({...m,[key]:{text,ok}}))
      if(ok) setResults(prev=>({...prev,[`${client.id}-${syncType}`]:d.results}))
      
      // Refresh last sync time
      fetch('/api/oms-clients').then(r=>r.json()).then(d=>
        setClients((d.clients??[]).filter((c:Client)=>c.auth_status===1))
      )
    } catch(e:any) {
      setMsgs(m=>({...m,[key]:{text:`❌ ${e.message}`,ok:false}}))
    }
    setSyncing(null)
  }

  const card:React.CSSProperties = {background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>数据同步</h1>
        <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>从领星OMS拉取各客户单据，按类型分别同步避免超时</p>
      </div>

      {loading ? <div style={{...card,padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>加载中...</div>
      : clients.length===0 ? (
        <div style={{...card,padding:'40px',textAlign:'center' as const}}>
          <div style={{color:'#94a3b8',fontSize:'13px',marginBottom:'12px'}}>暂无已绑定AppKey的客户</div>
          <a href="/warehouse/clients" style={{color:'#2563eb',fontSize:'13px'}}>前往客户管理绑定 →</a>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column' as const,gap:'16px'}}>
          {clients.map(client=>(
            <div key={client.id} style={card}>
              <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontSize:'14px',fontWeight:700,color:'#0f172a'}}>{client.customer_name}</span>
                <span style={{fontSize:'11px',color:'#94a3b8',padding:'1px 6px',background:'#f1f5f9',borderRadius:'4px'}}>{client.customer_code}</span>
                {client.last_synced_at && <span style={{fontSize:'11px',color:'#94a3b8',marginLeft:'auto'}}>上次：{new Date(client.last_synced_at).toLocaleString('zh-CN')}</span>}
              </div>
              <div style={{padding:'14px 18px',display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'10px'}}>
                {SYNC_TYPES.map(type=>{
                  const key   = `${client.id}-${type.key}`
                  const busy  = syncing === key
                  const msg   = msgs[key]
                  const res   = results[key]
                  return (
                    <div key={type.key} style={{padding:'12px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px',marginBottom:'5px'}}>
                        <span style={{fontSize:'16px'}}>{type.icon}</span>
                        <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>{type.label}</span>
                      </div>
                      <div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'8px'}}>{type.desc}</div>
                      {msg && (
                        <div style={{fontSize:'11px',color:msg.ok?'#16a34a':'#dc2626',marginBottom:'6px',lineHeight:1.5}}>
                          {msg.text}
                          {res?.[type.key] && <span style={{color:'#94a3b8',marginLeft:'4px'}}>
                            (新增{res[type.key].created??0} 更新{res[type.key].skipped??0})
                          </span>}
                        </div>
                      )}
                      <button
                        onClick={()=>sync(client,type.key)}
                        disabled={!!syncing}
                        style={{width:'100%',padding:'6px',borderRadius:'6px',border:'1px solid #bfdbfe',background:busy?'#e0f2fe':'#eff6ff',color:busy?'#0284c7':'#2563eb',cursor:syncing?'not-allowed':'pointer',fontSize:'12px',fontWeight:600}}>
                        {busy ? '⟳ 同步中...' : '↻ 同步'}
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{marginTop:'16px',padding:'12px 16px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0',fontSize:'12px',color:'#64748b',lineHeight:1.8}}>
        <strong style={{color:'#475569'}}>⏱ 说明：</strong>
        每次只同步一种类型，避免Vercel函数超时 ·
        「一件代发」同步后可在「仓库总览→一件代发明细」查看完整物流数据 ·
        每次最多同步250条（5页×50条）
      </div>
    </div>
  )
}
