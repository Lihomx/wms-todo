'use client'
import { useState, useEffect } from 'react'

interface Client {
  id: string; customer_code: string; customer_name: string
  oms_account: string; company_name: string; status: string
  can_use_warehouse: number
}

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([])
  const [loading, setLoading] = useState(true)
  const [syncing, setSyncing] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/oms-clients')
    const d = await res.json()
    setClients(d.clients ?? [])
    setLoading(false)
  }

  const syncFromOms = async () => {
    setSyncing(true); setMsg('')
    const res = await fetch('/api/oms-clients/sync', { method: 'POST' })
    const d = await res.json()
    setMsg(d.error ? `❌ ${d.error}` : `✅ ${d.message ?? '同步完成'}`)
    await load(); setSyncing(false)
  }

  useEffect(() => { load() }, [])

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#0d1117',padding:'28px 24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:800,color:'#f1f5f9'}}>OMS 客户管理</h1>
          <p style={{fontSize:'12px',color:'#475569',marginTop:'4px'}}>管理所有OMS客户，可跳转到各客户OMS登录</p>
        </div>
        <button onClick={syncFromOms} disabled={syncing} style={{padding:'8px 18px',borderRadius:'7px',background:syncing?'#1e3a5f':'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:syncing?'not-allowed':'pointer'}}>
          {syncing ? '⟳ 同步中...' : '⟳ 从OMS同步客户'}
        </button>
      </div>
      {msg && <div style={{marginBottom:'16px',padding:'10px 14px',borderRadius:'8px',background:msg.includes('❌')?'#ef444415':'#22c55e15',border:`1px solid ${msg.includes('❌')?'#ef444433':'#22c55e33'}`,color:msg.includes('❌')?'#ef4444':'#22c55e',fontSize:'13px'}}>{msg}</div>}
      {loading ? (
        <div style={{textAlign:'center' as const,padding:'40px',color:'#475569'}}>加载中...</div>
      ) : (
        <div style={{background:'#161b26',border:'1px solid #2a3250',borderRadius:'12px',overflow:'hidden'}}>
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
            <thead>
              <tr style={{background:'#0a0d14',borderBottom:'1px solid #2a3250'}}>
                {['客户代码','客户名称','OMS账号','公司名称','状态','操作'].map(h=>(
                  <th key={h} style={{padding:'12px 16px',color:'#64748b',fontWeight:700,textAlign:'left' as const,whiteSpace:'nowrap' as const}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {clients.length === 0 ? (
                <tr><td colSpan={6} style={{padding:'40px',textAlign:'center' as const,color:'#475569'}}>暂无数据，点击「从OMS同步客户」获取</td></tr>
              ) : clients.map((c,i)=>(
                <tr key={c.id} style={{borderBottom:'1px solid #1a2035',background:i%2===0?'transparent':'#0d1117'}}>
                  <td style={{padding:'12px 16px',color:'#3b82f6',fontWeight:600}}>{c.customer_code}</td>
                  <td style={{padding:'12px 16px',color:'#f1f5f9',fontWeight:600}}>{c.customer_name}</td>
                  <td style={{padding:'12px 16px',color:'#94a3b8'}}>{c.oms_account || '-'}</td>
                  <td style={{padding:'12px 16px',color:'#94a3b8'}}>{c.company_name || '-'}</td>
                  <td style={{padding:'12px 16px'}}>
                    <span style={{padding:'2px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:600,background:c.status==='active'?'#22c55e22':'#ef444422',color:c.status==='active'?'#22c55e':'#ef4444'}}>
                      {c.status==='active'?'启用':'停用'}
                    </span>
                  </td>
                  <td style={{padding:'12px 16px'}}>
                    <div style={{display:'flex',gap:'6px'}}>
                      <button onClick={()=>window.open('https://oms.xlwms.com','_blank')} style={{padding:'5px 10px',borderRadius:'5px',border:'1px solid #3b82f633',background:'#1e3a5f',color:'#3b82f6',cursor:'pointer',fontSize:'11px',fontWeight:600,whiteSpace:'nowrap' as const}}>
                        🔗 跳转OMS登录
                      </button>
                      <button onClick={()=>window.location.href=`/warehouse/todos?client=${c.customer_code}`} style={{padding:'5px 10px',borderRadius:'5px',border:'1px solid #22c55e33',background:'#14532d22',color:'#22c55e',cursor:'pointer',fontSize:'11px',fontWeight:600}}>
                        📋 待办
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
