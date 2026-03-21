'use client'
import { useState, useEffect } from 'react'

// ── Carrier detection rules ──────────────────────────────────────────────
interface CarrierRule {
  name: string
  color: string
  bg: string
  prefixes: string[]
  minLen: number
  maxLen: number
  icon: string
}

const CARRIERS: CarrierRule[] = [
  { name:'MercadoLibre', color:'#d97706', bg:'#fffbeb', prefixes:['465'],      minLen:10, maxLen:13, icon:'🟡' },
  { name:'J&T Express',  color:'#dc2626', bg:'#fef2f2', prefixes:['GC','JMX'], minLen:14, maxLen:19, icon:'🔴' },
  { name:'iMile',        color:'#7c3aed', bg:'#f5f3ff', prefixes:['48','GC'],  minLen:13, maxLen:19, icon:'🟣' },
  { name:'其他',          color:'#64748b', bg:'#f8fafc', prefixes:[],           minLen:0,  maxLen:999,icon:'⚪' },
]

function detectCarrier(trackNo: string): string {
  if (!trackNo || trackNo === '-') return '其他'
  const t = trackNo.trim()
  const len = t.length
  for (const r of CARRIERS.slice(0, -1)) {  // skip "其他"
    const prefixMatch = r.prefixes.length === 0 || r.prefixes.some(p => t.startsWith(p))
    const lenMatch    = len >= r.minLen && len <= r.maxLen
    if (prefixMatch && lenMatch) return r.name
  }
  return '其他'
}

interface Order {
  lingxing_order_no: string
  status: number
  extra_data: any
}

export default function DailyDispatchPage() {
  const [orders,    setOrders]    = useState<Order[]>([])
  const [loading,   setLoading]   = useState(true)
  const [dateStr,   setDateStr]   = useState(() => new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit'}).replace(/\//g,'-'))
  const [expanded,  setExpanded]  = useState<string|null>(null)

  useEffect(()=>{
    setLoading(true)
    fetch('/api/todos?pageSize=2000&category=出库作业').then(r=>r.json()).then(d=>{
      setOrders(d.todos??[])
      setLoading(false)
    })
  },[])

  // Filter: unshipped = OMS status NOT 3 (已出库)
  // apiStatus: 0=待处理, 2=处理中, 3=已出库, 4=已取消, 5=异常
  const unshipped = orders.filter(o => {
    const apiStatus = o.extra_data?.apiStatus ?? o.extra_data?.status
    return apiStatus !== 3 && apiStatus !== 4  // not 已出库 and not 已取消
  })

  // Group by carrier
  const byCarrier: Record<string, Order[]> = {}
  for (const c of CARRIERS) byCarrier[c.name] = []
  for (const o of unshipped) {
    const trackNo  = o.extra_data?.logisticsTrackNo || ''
    const carrier  = detectCarrier(trackNo)
    byCarrier[carrier].push(o)
  }

  const total = unshipped.length
  const rule = CARRIERS.reduce((r,c)=>{ r[c.name]=c; return r },{} as Record<string,CarrierRule>)

  const card: React.CSSProperties = { background:'#fff', border:'1px solid #e2e8f0', borderRadius:'10px', boxShadow:'0 1px 3px rgba(0,0,0,0.05)' }

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'24px 32px'}}>
      <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>📋 每日代发详情</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>统计当天未出库包裹数，便于与物流公司核对交件数量</p>
        </div>
        <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
          <span style={{fontSize:'13px',color:'#64748b'}}>统计日期</span>
          <input type="date" value={dateStr} onChange={e=>setDateStr(e.target.value)}
            style={{padding:'6px 10px',borderRadius:'6px',border:'1px solid #e2e8f0',fontSize:'13px',outline:'none'}}/>
          <span style={{padding:'4px 12px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'12px',fontWeight:600,border:'1px solid #bfdbfe'}}>
            {loading?'…':total} 件未出库
          </span>
        </div>
      </div>

      {/* Summary cards */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:'12px',marginBottom:'20px'}}>
        {CARRIERS.map(c=>{
          const count = byCarrier[c.name]?.length ?? 0
          const pct   = total > 0 ? Math.round(count/total*100) : 0
          return (
            <div key={c.name} style={{...card,padding:'16px 18px',borderLeft:`4px solid ${c.color}`,cursor:'pointer',transition:'box-shadow 0.15s',boxShadow:expanded===c.name?`0 0 0 2px ${c.color}33`:'0 1px 3px rgba(0,0,0,0.05)'}}
              onClick={()=>setExpanded(expanded===c.name?null:c.name)}>
              <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>{c.icon} {c.name}</span>
                <span style={{fontSize:'11px',color:'#94a3b8'}}>{pct}%</span>
              </div>
              <div style={{fontSize:'32px',fontWeight:800,color:c.color,lineHeight:1}}>{loading?'…':count}</div>
              <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'5px'}}>未出库包裹</div>
              {/* Progress bar */}
              <div style={{marginTop:'10px',height:'4px',borderRadius:'2px',background:'#f1f5f9'}}>
                <div style={{height:'100%',borderRadius:'2px',background:c.color,width:`${pct}%`,transition:'width 0.3s'}}/>
              </div>
            </div>
          )
        })}
      </div>

      {/* Carrier rules reminder */}
      <div style={{...card,padding:'12px 16px',marginBottom:'16px',background:'#f8fafc'}}>
        <div style={{fontSize:'12px',fontWeight:600,color:'#475569',marginBottom:'6px'}}>📌 识别规则</div>
        <div style={{display:'flex',gap:'20px',flexWrap:'wrap' as const}}>
          {CARRIERS.slice(0,-1).map(c=>(
            <div key={c.name} style={{fontSize:'11px',color:'#64748b'}}>
              <span style={{color:c.color,fontWeight:600}}>{c.icon} {c.name}：</span>
              {c.prefixes.length>0?`前缀 ${c.prefixes.join('/')}，`:''}
              长度 {c.minLen}–{c.maxLen} 位
            </div>
          ))}
        </div>
      </div>

      {/* Detail table per carrier */}
      {CARRIERS.map(carrier=>{
        const rows = byCarrier[carrier.name] ?? []
        if(expanded !== carrier.name || rows.length===0) return null
        return (
          <div key={carrier.name} style={{...card,marginBottom:'14px',overflow:'hidden'}}>
            <div style={{padding:'12px 16px',background:carrier.bg,borderBottom:`2px solid ${carrier.color}30`,display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <span style={{fontSize:'14px',fontWeight:700,color:carrier.color}}>{carrier.icon} {carrier.name} · {rows.length} 件</span>
              <button onClick={()=>setExpanded(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'16px'}}>×</button>
            </div>
            <div style={{overflowX:'auto' as const}}>
              <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'12px'}}>
                <thead><tr style={{background:'#f8fafc'}}>
                  {['出库单号','物流跟踪号','收件人','城市/州','平台','店铺','创建时间'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',fontWeight:600,color:'#64748b',textAlign:'left' as const,borderBottom:'1px solid #e2e8f0',whiteSpace:'nowrap' as const,fontSize:'11px'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {rows.map((o,i)=>{
                    const e = o.extra_data ?? {}
                    const apiSt = e.apiStatus
                    const stLabel = apiSt===0?'待处理':apiSt===2?'处理中':apiSt===5?'异常':'未知'
                    const stColor = apiSt===5?'#dc2626':apiSt===2?'#3b82f6':'#f97316'
                    return (
                      <tr key={o.lingxing_order_no} style={{borderBottom:'1px solid #f8fafc',background:i%2===0?'#fff':'#fafbfc'}}>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',fontSize:'11px',color:'#2563eb',whiteSpace:'nowrap' as const}}>
                          {o.lingxing_order_no}
                          <span style={{marginLeft:'6px',padding:'1px 5px',borderRadius:'3px',background:`${stColor}15`,color:stColor,fontSize:'10px'}}>{stLabel}</span>
                        </td>
                        <td style={{padding:'9px 12px',fontFamily:'monospace',fontWeight:600,color:'#0f172a',whiteSpace:'nowrap' as const}}>{e.logisticsTrackNo||'-'}</td>
                        <td style={{padding:'9px 12px',whiteSpace:'nowrap' as const}}>{e.receiver||'-'}</td>
                        <td style={{padding:'9px 12px',whiteSpace:'nowrap' as const,color:'#64748b'}}>{e.cityName||'-'}{e.provinceName?`, ${e.provinceName.replace(/\(.*\)/,'').trim()}`:''}</td>
                        <td style={{padding:'9px 12px',whiteSpace:'nowrap' as const}}>{e.salesPlatformName||e.salesPlatform||'-'}</td>
                        <td style={{padding:'9px 12px',whiteSpace:'nowrap' as const,color:'#64748b'}}>{e.storeName||'-'}</td>
                        <td style={{padding:'9px 12px',whiteSpace:'nowrap' as const,color:'#94a3b8',fontSize:'11px'}}>
                          {e.orderCreateTime?new Date(e.orderCreateTime).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}):'-'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )
      })}

      {/* All unshipped summary table */}
      {!loading && unshipped.length > 0 && (
        <div style={card}>
          <div style={{padding:'12px 16px',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
            <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>全部未出库清单（{total} 件）</span>
            <span style={{fontSize:'11px',color:'#94a3b8'}}>点击上方物流公司卡片可查看该物流的详细列表</span>
          </div>
          <div style={{overflowX:'auto' as const,maxHeight:'400px',overflowY:'auto' as const}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'12px'}}>
              <thead style={{position:'sticky' as const,top:0,zIndex:1}}>
                <tr style={{background:'#f8fafc'}}>
                  {['物流公司','出库单号','物流跟踪号','收件人','城市','平台','状态'].map(h=>(
                    <th key={h} style={{padding:'8px 12px',fontWeight:600,color:'#64748b',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap' as const,fontSize:'11px'}}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {unshipped.map((o,i)=>{
                  const e = o.extra_data ?? {}
                  const trackNo  = e.logisticsTrackNo||''
                  const carrier  = detectCarrier(trackNo)
                  const rule     = CARRIERS.find(c=>c.name===carrier)!
                  const apiSt    = e.apiStatus
                  const stLabel  = apiSt===0?'待处理':apiSt===2?'处理中':apiSt===5?'异常':'未知'
                  const stColor  = apiSt===5?'#dc2626':apiSt===2?'#3b82f6':'#f97316'
                  return (
                    <tr key={o.lingxing_order_no} style={{borderBottom:'1px solid #f8fafc',background:i%2===0?'#fff':'#fafbfc'}}>
                      <td style={{padding:'8px 12px',whiteSpace:'nowrap' as const}}>
                        <span style={{color:rule.color,fontWeight:600,fontSize:'11px'}}>{rule.icon} {carrier}</span>
                      </td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontSize:'11px',color:'#475569'}}>{o.lingxing_order_no}</td>
                      <td style={{padding:'8px 12px',fontFamily:'monospace',fontWeight:600,color:'#0f172a'}}>{trackNo||'-'}</td>
                      <td style={{padding:'8px 12px'}}>{e.receiver||'-'}</td>
                      <td style={{padding:'8px 12px',color:'#64748b'}}>{e.cityName||'-'}</td>
                      <td style={{padding:'8px 12px'}}>{e.salesPlatformName||e.salesPlatform||'-'}</td>
                      <td style={{padding:'8px 12px'}}>
                        <span style={{padding:'1px 6px',borderRadius:'3px',background:`${stColor}15`,color:stColor,fontSize:'10px',fontWeight:600}}>{stLabel}</span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
