'use client'
import { useState, useEffect } from 'react'

interface Client { id:string; customer_code:string; customer_name:string; auth_status:number; last_synced_at:string|null }
interface SyncResult { success:boolean; message:string; results?:any }

export default function WarehouseSyncPage() {
  const [clients,  setClients]  = useState<Client[]>([])
  const [loading,  setLoading]  = useState(true)
  const [syncing,  setSyncing]  = useState<string|null>(null)
  const [results,  setResults]  = useState<Record<string,SyncResult>>({})

  useEffect(()=>{
    fetch('/api/oms-clients').then(r=>r.json()).then(d=>{
      setClients((d.clients??[]).filter((c:Client)=>c.auth_status===1))
      setLoading(false)
    })
  },[])

  const syncClient = async (client: Client) => {
    setSyncing(client.id)
    const r = await fetch('/api/oms-clients/sync-data',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({clientId:client.id,customerCode:client.customer_code})})
    const d = await r.json()
    setResults(prev=>({...prev,[client.id]:{success:!d.error,message:d.error?`❌ ${d.error}`:`✅ ${d.message}`,results:d.results}}))
    setSyncing(null)
    fetch('/api/oms-clients').then(r=>r.json()).then(d=>setClients((d.clients??[]).filter((c:Client)=>c.auth_status===1)))
  }

  const syncAll = async () => {
    for(const c of clients) await syncClient(c)
  }

  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'18px 20px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>数据同步</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>从领星OMS拉取各客户单据数据，生成待办任务</p>
        </div>
        <button onClick={syncAll} disabled={!!syncing||loading} style={{padding:'9px 20px',borderRadius:'8px',background:syncing?'#e2e8f0':'#2563eb',border:'none',color:syncing?'#94a3b8':'white',fontWeight:600,fontSize:'13px',cursor:syncing?'not-allowed':'pointer'}}>
          ↻ 全部同步
        </button>
      </div>

      {loading ? <div style={{textAlign:'center' as const,padding:'40px',color:'#94a3b8'}}>加载中...</div>
      : clients.length===0 ? (
        <div style={{...card,textAlign:'center' as const,padding:'40px',color:'#94a3b8'}}>
          暂无已绑定AppKey的客户，请先在「客户管理」页面绑定
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column' as const,gap:'10px'}}>
          {clients.map(c=>{
            const res = results[c.id]
            return (
              <div key={c.id} style={{...card,display:'flex',alignItems:'center',gap:'16px'}}>
                <div style={{flex:1}}>
                  <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:'3px'}}>
                    <span style={{fontSize:'14px',fontWeight:600,color:'#0f172a'}}>{c.customer_name}</span>
                    <span style={{fontSize:'11px',color:'#94a3b8'}}>{c.customer_code}</span>
                  </div>
                  <div style={{fontSize:'12px',color:'#94a3b8'}}>
                    {c.last_synced_at ? `上次同步：${new Date(c.last_synced_at).toLocaleString('zh-CN')}` : '从未同步'}
                  </div>
                  {res && (
                    <div style={{marginTop:'8px',fontSize:'12px',color:res.success?'#16a34a':'#dc2626',fontWeight:500}}>
                      {res.message}
                    </div>
                  )}
                </div>
                <button onClick={()=>syncClient(c)} disabled={syncing===c.id} style={{padding:'8px 16px',borderRadius:'7px',background:syncing===c.id?'#f1f5f9':'#eff6ff',border:'1px solid #bfdbfe',color:syncing===c.id?'#94a3b8':'#2563eb',cursor:syncing===c.id?'not-allowed':'pointer',fontSize:'12px',fontWeight:600,flexShrink:0}}>
                  {syncing===c.id?'同步中...':'↻ 同步'}
                </button>
              </div>
            )
          })}
        </div>
      )}

      <div style={{marginTop:'20px',padding:'14px 16px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0',fontSize:'12px',color:'#64748b',lineHeight:1.8}}>
        <span style={{fontWeight:600,color:'#475569'}}>ℹ️ 说明：</span>
        同步不会重复创建（相同单号只建一次）· 已完成待办不会重新激活
      </div>
    </div>
  )
}
