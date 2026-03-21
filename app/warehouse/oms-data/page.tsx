'use client'
import { useState, useEffect } from 'react'

interface Client { id:string; customer_code:string; customer_name:string; auth_status:number }
interface Summary { label:string; total:number; error?:string }

export default function WarehouseOmsDataPage() {
  const [clients,  setClients]  = useState<Client[]>([])
  const [scanning, setScanning] = useState<string|null>(null)
  const [results,  setResults]  = useState<Record<string, Record<string,Summary>>>({})
  const [loading,  setLoading]  = useState(true)

  useEffect(()=>{
    fetch('/api/oms-clients').then(r=>r.json()).then(d=>{
      setClients((d.clients??[]).filter((c:Client)=>c.auth_status===1))
      setLoading(false)
    })
  },[])

  const scanClient = async(client: Client) => {
    setScanning(client.id)
    const r = await fetch(`/api/lingxing/data?type=all&clientId=${client.id}`)
    const d = await r.json()
    setResults(prev=>({...prev,[client.customer_code]: d.summary??{}}))
    setScanning(null)
  }

  const scanAll = async() => {
    for(const c of clients) await scanClient(c)
  }

  const DATA_ICONS:Record<string,string> = {
    warehouses:'🏭', inbound:'📦', outbound:'🚚', bigOutbound:'🚛', returns:'↩️', inventory:'📊'
  }

  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:'#eff6ff',border:'1px solid #bfdbfe',fontSize:'12px',color:'#1e40af',lineHeight:1.7}}>
        <strong>ℹ️ 说明：</strong>此页面直接调用领星API查看实时总数（不写入本地数据库）。
        要同步出库单明细数据（物流跟踪号、收件人等），请前往
        <a href="/warehouse/sync" style={{color:'#2563eb',marginLeft:'4px',fontWeight:600}}>数据同步 →</a>
        按客户点击「🚚 一件代发 ↻ 同步」。
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'22px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>OMS 数据总览</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>查看所有已绑定客户的领星OMS数据概况</p>
        </div>
        <button onClick={scanAll} disabled={!!scanning||loading} style={{padding:'9px 18px',borderRadius:'8px',background:scanning?'#e2e8f0':'#2563eb',border:'none',color:scanning?'#94a3b8':'white',fontWeight:600,fontSize:'13px',cursor:scanning?'not-allowed':'pointer'}}>
          ↻ 扫描全部客户
        </button>
      </div>

      {loading ? <div style={{...card,padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>加载中...</div>
      : clients.length===0 ? (
        <div style={{...card,padding:'40px',textAlign:'center' as const}}>
          <div style={{color:'#94a3b8',fontSize:'13px',marginBottom:'12px'}}>暂无已绑定AppKey的客户</div>
          <a href="/warehouse/clients" style={{color:'#2563eb',fontSize:'13px'}}>前往客户管理绑定 →</a>
        </div>
      ) : (
        <div style={{display:'flex',flexDirection:'column' as const,gap:'14px'}}>
          {clients.map(client=>{
            const summary = results[client.customer_code]
            const isScanning = scanning === client.id
            return (
              <div key={client.id} style={card}>
                <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
                  <div>
                    <span style={{fontSize:'14px',fontWeight:600,color:'#0f172a'}}>{client.customer_name}</span>
                    <span style={{marginLeft:'8px',fontSize:'11px',color:'#94a3b8',padding:'1px 6px',background:'#f1f5f9',borderRadius:'4px'}}>{client.customer_code}</span>
                  </div>
                  <button onClick={()=>scanClient(client)} disabled={!!scanning} style={{padding:'6px 14px',borderRadius:'6px',background:isScanning?'#f1f5f9':'#eff6ff',border:'1px solid #bfdbfe',color:isScanning?'#94a3b8':'#2563eb',cursor:scanning?'not-allowed':'pointer',fontSize:'12px',fontWeight:500}}>
                    {isScanning?'扫描中...':'↻ 扫描'}
                  </button>
                </div>
                {!summary ? (
                  <div style={{padding:'20px 18px',color:'#94a3b8',fontSize:'13px'}}>
                    点击「扫描」获取该客户的OMS数据概况
                  </div>
                ) : (
                  <div style={{padding:'14px 18px',display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:'10px'}}>
                    {Object.entries(summary).map(([key, s]: [string, any])=>(
                      <div key={key} style={{textAlign:'center' as const,padding:'12px 8px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #f1f5f9'}}>
                        <div style={{fontSize:'18px',marginBottom:'4px'}}>{DATA_ICONS[key]??'📋'}</div>
                        <div style={{fontSize:'20px',fontWeight:700,color:s.error?'#dc2626':s.total>0?'#2563eb':'#0f172a'}}>{s.error?'!':s.total}</div>
                        <div style={{fontSize:'11px',color:'#64748b',marginTop:'2px'}}>{s.label}</div>
                        {s.error && <div style={{fontSize:'10px',color:'#dc2626',marginTop:'3px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}} title={s.error}>错误</div>}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
