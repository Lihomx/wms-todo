'use client'
import { useState } from 'react'
import Link from 'next/link'

const SYNC_TYPES = [
  {key:'inbound',     label:'入库单',   icon:'📦', desc:'同步入库单 → 生成入库作业待办'},
  {key:'outbound',    label:'小包出库', icon:'🚚', desc:'同步一件代发出库单 → 生成出库待办'},
  {key:'bigOutbound', label:'大货出库', icon:'🚛', desc:'同步FBA备货/送仓单 → 生成出库待办'},
  {key:'returns',     label:'退件单',   icon:'↩️', desc:'同步退件记录 → 生成退货处理待办'},
  {key:'inventory',   label:'库存预警', icon:'📊', desc:'扫描低库存(≤10) → 生成库存预警待办'},
]

interface SyncResult {success:boolean;message:string;created:number;skipped:number;errors:string[]}

export default function SyncPage() {
  const [results,  setResults]  = useState<Record<string,SyncResult>>({})
  const [loading,  setLoading]  = useState<Record<string,boolean>>({})
  const [syncing,  setSyncing]  = useState(false)
  const [lastSync, setLastSync] = useState<string|null>(null)
  const [globalErr, setGlobalErr] = useState('')

  const doSync = async (type: string) => {
    const isAll = type === 'all'
    if(isAll) { setSyncing(true); setGlobalErr('') }
    else setLoading(l=>({...l,[type]:true}))

    try {
      const res  = await fetch('/api/lingxing/sync', {
        method: 'POST',
        headers: {'Content-Type':'application/json'},
        body: JSON.stringify({type}),
      })
      const data = await res.json()

      if(!res.ok || data.error) {
        const msg = data.error ?? '同步失败'
        if(isAll) setGlobalErr(msg)
        else setResults(r=>({...r,[type]:{success:false,message:msg,created:0,skipped:0,errors:[msg]}}))
        return
      }

      if(isAll && data.results) {
        setResults(data.results)
        setLastSync(new Date().toLocaleString('zh-CN'))
      } else {
        setResults(r=>({...r,[type]:data}))
      }
    } catch(e:any) {
      const msg = e.message ?? '网络错误'
      if(isAll) setGlobalErr(msg)
      else setResults(r=>({...r,[type]:{success:false,message:msg,created:0,skipped:0,errors:[msg]}}))
    } finally {
      if(isAll) setSyncing(false)
      else setLoading(l=>({...l,[type]:false}))
    }
  }

  const anyLoading = syncing || Object.values(loading).some(Boolean)

  return (
    <div style={{flex:1,overflowY:'auto',background:'#f8fafc'}}>
      <div style={{maxWidth:'900px',margin:'0 auto',padding:'28px 24px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'28px'}}>
          <div>
            <h1 style={{fontSize:'20px',fontWeight:800,color:'#0f172a'}}>数据同步</h1>
            <p style={{fontSize:'12px',color:'#6b7280',marginTop:'4px'}}>
              从领星OMS拉取数据，自动生成待办任务{lastSync?` · 上次同步：${lastSync}`:''}
            </p>
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <Link href="/wms/oms-data" style={{padding:'8px 16px',borderRadius:'7px',border:'1px solid #e2e8f0',color:'#64748b',textDecoration:'none',fontSize:'12px'}}>📊 数据总览</Link>
            <button onClick={()=>doSync('all')} disabled={anyLoading} style={{padding:'8px 20px',borderRadius:'7px',background:anyLoading?'#1e3a5f':'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:anyLoading?'not-allowed':'pointer',boxShadow:anyLoading?'none':'0 0 12px #3b82f644',transition:'all 0.2s'}}>
              {syncing ? '⟳ 同步中...' : '⟳ 一键全部同步'}
            </button>
          </div>
        </div>

        {globalErr && (
          <div style={{marginBottom:'16px',padding:'12px 16px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',color:'#ef4444',fontSize:'13px'}}>
            ❌ {globalErr}
          </div>
        )}

        <div style={{display:'flex',flexDirection:'column',gap:'10px'}}>
          {SYNC_TYPES.map(s=>{
            const r = results[s.key]
            const isLoading = loading[s.key] || syncing
            return (
              <div key={s.key} style={{background:'#ffffff',border:`1px solid ${r?.success===true?'#22c55e33':r?.success===false?'#ef444433':'#e2e8f0'}`,borderRadius:'12px',padding:'16px 20px',display:'flex',alignItems:'center',gap:'16px',transition:'border-color 0.2s'}}>
                <div style={{fontSize:'26px',width:'36px',textAlign:'center' as const,flexShrink:0}}>{s.icon}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:'14px',fontWeight:700,color:'#0f172a'}}>{s.label}</div>
                  <div style={{fontSize:'11px',color:'#6b7280',marginTop:'2px'}}>{s.desc}</div>
                  {r && (
                    <div style={{marginTop:'8px',display:'flex',gap:'8px',alignItems:'center',flexWrap:'wrap' as const}}>
                      <span style={{fontSize:'12px',color:r.success?'#22c55e':'#ef4444',fontWeight:600}}>
                        {r.success ? '✅' : '❌'} {r.message}
                      </span>
                      {r.created > 0 && <span style={{fontSize:'11px',padding:'1px 8px',borderRadius:'4px',background:'#22c55e22',color:'#22c55e',fontWeight:600}}>+{r.created} 新建</span>}
                      {r.skipped > 0 && <span style={{fontSize:'11px',padding:'1px 8px',borderRadius:'4px',background:'#64748b22',color:'#64748b'}}>跳过 {r.skipped}</span>}
                    </div>
                  )}
                  {r?.errors?.length > 0 && (
                    <div style={{marginTop:'4px',fontSize:'11px',color:'#ef4444',opacity:0.8}}>{r.errors[0]}</div>
                  )}
                </div>
                <button onClick={()=>doSync(s.key)} disabled={anyLoading} style={{padding:'8px 18px',borderRadius:'7px',border:'1px solid #bfdbfe',background:anyLoading?'transparent':'#1e3a5f',color:anyLoading?'#334155':'#3b82f6',cursor:anyLoading?'not-allowed':'pointer',fontSize:'12px',fontWeight:700,flexShrink:0,transition:'all 0.2s',minWidth:'72px'}}>
                  {loading[s.key] ? '⟳' : '↻ 同步'}
                </button>
              </div>
            )
          })}
        </div>

        <div style={{marginTop:'20px',padding:'14px 16px',background:'#1e3a5f15',border:'1px solid #3b82f622',borderRadius:'10px',fontSize:'12px',color:'#6b7280',lineHeight:2}}>
          <span style={{fontWeight:700,color:'#3b82f6'}}>ℹ️ 同步说明：</span>
          此页面使用当前绑定凭证同步数据。如需按客户同步，请前往
          <a href="/warehouse/clients" style={{color:'#3b82f6',marginLeft:'4px'}}>🏭 仓库管理端 → 客户管理</a>，
          为每个客户绑定AppKey后单独同步。
          Railway Worker 每15分钟自动同步（部署后生效）
        </div>
      </div>
    </div>
  )
}
