'use client'
import { useState } from 'react'
import Link from 'next/link'

const SYNC_TYPES = [
  { key:'inbound',     label:'入库单',     icon:'📦', desc:'同步入库单 → 生成入库待办' },
  { key:'outbound',    label:'小包出库',   icon:'🚚', desc:'同步一件代发出库单' },
  { key:'bigOutbound', label:'大货出库',   icon:'🚛', desc:'同步FBA备货/送仓单' },
  { key:'returns',     label:'退件单',     icon:'↩️', desc:'同步退件记录 → 生成退件待办' },
  { key:'inventory',   label:'库存预警',   icon:'📊', desc:'扫描低库存 → 生成预警待办' },
]

interface SyncResult { success:boolean; created:number; skipped:number; errors:string[]; message:string }

export default function SyncPage() {
  const [results,  setResults]  = useState<Record<string,SyncResult>>({})
  const [loading,  setLoading]  = useState<Record<string,boolean>>({})
  const [syncing,  setSyncing]  = useState(false)
  const [lastSync, setLastSync] = useState<string|null>(null)

  const syncOne = async (type: string) => {
    setLoading(l=>({...l,[type]:true}))
    try {
      const res  = await fetch('/api/lingxing/sync', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type}) })
      const data = await res.json()
      setResults(r=>({...r,[type]:data}))
    } catch(e:any) {
      setResults(r=>({...r,[type]:{success:false,created:0,skipped:0,errors:[e.message],message:'同步失败'}}))
    }
    setLoading(l=>({...l,[type]:false}))
  }

  const syncAll = async () => {
    setSyncing(true)
    const res  = await fetch('/api/lingxing/sync', { method:'POST', headers:{'Content-Type':'application/json'}, body:JSON.stringify({type:'all'}) })
    const data = await res.json()
    if (data.results) setResults(data.results)
    setLastSync(new Date().toLocaleString('zh-CN'))
    setSyncing(false)
  }

  return (
    <div style={{flex:1,overflowY:'auto',background:'#0d1117'}}>
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'28px 24px'}}>

        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'28px'}}>
          <div>
            <h1 style={{fontSize:'20px',fontWeight:800,color:'#f1f5f9'}}>数据同步</h1>
            <p style={{fontSize:'12px',color:'#475569',marginTop:'4px'}}>
              从领星OMS拉取数据，自动生成待办任务{lastSync?` · 上次同步：${lastSync}`:''}
            </p>
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <Link href="/wms/oms-data" style={{padding:'8px 16px',borderRadius:'7px',border:'1px solid #2a3250',color:'#64748b',textDecoration:'none',fontSize:'12px'}}>📊 数据总览</Link>
            <button onClick={syncAll} disabled={syncing} style={{padding:'8px 20px',borderRadius:'7px',background:'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:syncing?'not-allowed':'pointer',opacity:syncing?0.6:1,boxShadow:'0 0 12px #3b82f644'}}>
              {syncing?'⟳ 同步中...':'⟳ 一键全部同步'}
            </button>
          </div>
        </div>

        {/* Sync items */}
        <div style={{display:'flex',flexDirection:'column',gap:'12px'}}>
          {SYNC_TYPES.map(s=>{
            const r=results[s.key]
            const isLoading=loading[s.key]
            return (
              <div key={s.key} style={{background:'#161b26',border:`1px solid ${r?.success?'#22c55e33':r?.success===false?'#ef444433':'#2a3250'}`,borderRadius:'12px',padding:'18px 20px',display:'flex',alignItems:'center',gap:'16px'}}>
                <div style={{fontSize:'28px',flexShrink:0}}>{s.icon}</div>
                <div style={{flex:1}}>
                  <div style={{fontSize:'14px',fontWeight:700,color:'#f1f5f9'}}>{s.label}</div>
                  <div style={{fontSize:'11px',color:'#475569',marginTop:'2px'}}>{s.desc}</div>
                  {r && (
                    <div style={{marginTop:'8px',display:'flex',gap:'10px',alignItems:'center',flexWrap:'wrap' as const}}>
                      {r.success
                        ? <span style={{fontSize:'12px',color:'#22c55e',fontWeight:600}}>✅ {r.message}</span>
                        : <span style={{fontSize:'12px',color:'#ef4444',fontWeight:600}}>❌ {r.message}</span>}
                      {r.created>0 && <span style={{fontSize:'11px',padding:'1px 8px',borderRadius:'4px',background:'#22c55e22',color:'#22c55e'}}>新建 {r.created} 条</span>}
                      {r.skipped>0 && <span style={{fontSize:'11px',padding:'1px 8px',borderRadius:'4px',background:'#64748b22',color:'#64748b'}}>跳过 {r.skipped} 条</span>}
                    </div>
                  )}
                  {r?.errors?.length>0 && (
                    <div style={{marginTop:'6px',fontSize:'11px',color:'#ef4444'}}>
                      {r.errors.slice(0,2).map((e,i)=><div key={i}>{e}</div>)}
                    </div>
                  )}
                </div>
                <button onClick={()=>syncOne(s.key)} disabled={isLoading||syncing} style={{padding:'8px 18px',borderRadius:'7px',border:'1px solid #3b82f644',background:'#1e3a5f',color:'#3b82f6',cursor:(isLoading||syncing)?'not-allowed':'pointer',fontSize:'12px',fontWeight:700,flexShrink:0,opacity:(isLoading||syncing)?0.5:1}}>
                  {isLoading?'同步中...':'↻ 同步'}
                </button>
              </div>
            )
          })}
        </div>

        {/* Info box */}
        <div style={{marginTop:'24px',padding:'16px',background:'#1e3a5f22',border:'1px solid #3b82f622',borderRadius:'10px',fontSize:'12px',color:'#475569',lineHeight:1.8}}>
          <div style={{fontWeight:700,color:'#3b82f6',marginBottom:'6px'}}>ℹ️ 同步说明</div>
          <div>• 同步不会创建重复待办，相同单号只会创建一次</div>
          <div>• 已完成的待办不会被重新激活</div>
          <div>• Railway Worker 会每15分钟自动同步一次（部署后生效）</div>
          <div>• 手动同步可随时触发，不影响自动同步计划</div>
        </div>
      </div>
    </div>
  )
}
