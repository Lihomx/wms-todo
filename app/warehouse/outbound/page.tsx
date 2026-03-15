'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Todo {
  id: string; title: string; description: string|null; status: number
  customer_code: string|null; category: string; created_at: string
  lingxing_order_no: string|null
}

// Extract logistics carrier from description like "平台：Mercadolibre | 物流：J&T | 收件人：xxx"
function extractLogistics(desc: string|null): string {
  if (!desc) return '未知'
  const m = desc.match(/物流：([^|]+)/)
  if (m) return m[1].trim()
  const m2 = desc.match(/平台：([^|]+)/)
  if (m2) return m2[1].trim()
  return '未知'
}

function extractPlatform(desc: string|null): string {
  if (!desc) return '-'
  const m = desc.match(/平台：([^|]+)/)
  return m ? m[1].trim() : '-'
}

const CARRIER_COLORS: Record<string, string> = {
  'Mercadolibre': '#ffe600',
  'MercadoLibre': '#ffe600',
  'J&T': '#e2241a',
  'J&T EXPRESS': '#e2241a',
  'FedEx': '#4d148c',
  'FEDEX': '#4d148c',
  'DHL': '#fc0',
  'UPS': '#351c15',
  'USPS': '#336699',
  'Amazon': '#ff9900',
  'Other': '#64748b',
}

function getCarrierColor(carrier: string) {
  for (const [key, color] of Object.entries(CARRIER_COLORS)) {
    if (carrier.toLowerCase().includes(key.toLowerCase())) return color
  }
  return '#64748b'
}

const STATUS_LABEL = ['待处理','进行中','已完成','已取消']
const STATUS_COLOR = ['#f97316','#3b82f6','#22c55e','#64748b']

export default function OutboundDetailPage() {
  const [todos,   setTodos]   = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string|null>(null)

  useEffect(()=>{
    fetch('/api/todos?pageSize=500&category=出库作业')
      .then(r=>r.json())
      .then(d=>{ setTodos(d.todos??[]); setLoading(false) })
  },[])

  // Group by logistics carrier
  const groups: Record<string, Todo[]> = {}
  todos.forEach(t => {
    const carrier = extractLogistics(t.description)
    if (!groups[carrier]) groups[carrier] = []
    groups[carrier].push(t)
  })

  // Sort by count desc
  const sorted = Object.entries(groups).sort((a,b) => b[1].length - a[1].length)

  const card:React.CSSProperties = {background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      {/* Header */}
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'22px'}}>
        <Link href="/warehouse/dashboard" style={{color:'#94a3b8',textDecoration:'none',fontSize:'13px'}}>← 返回总览</Link>
        <span style={{color:'#e2e8f0'}}>/</span>
        <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>一件代发 · 按物流商明细</h1>
        <span style={{padding:'3px 10px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'12px',fontWeight:600,border:'1px solid #bfdbfe'}}>{todos.length} 条</span>
      </div>

      {loading ? (
        <div style={{...card,padding:'40px',textAlign:'center' as const,color:'#94a3b8'}}>加载中...</div>
      ) : (
        <>
          {/* Carrier summary cards */}
          <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(160px,1fr))',gap:'12px',marginBottom:'24px'}}>
            {sorted.map(([carrier, items])=>{
              const color = getCarrierColor(carrier)
              const pending = items.filter(t=>t.status===0).length
              return (
                <div key={carrier} onClick={()=>setSelected(selected===carrier?null:carrier)}
                  style={{...card,padding:'16px',cursor:'pointer',borderLeft:`4px solid ${color}`,background:selected===carrier?'#f8fbff':'#fff',border:selected===carrier?`1px solid ${color}`:'1px solid #e2e8f0',borderLeftWidth:'4px'}}>
                  <div style={{fontSize:'13px',fontWeight:700,color:'#0f172a',marginBottom:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}}>{carrier}</div>
                  <div style={{fontSize:'24px',fontWeight:800,color:color,lineHeight:1}}>{items.length}</div>
                  <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'3px'}}>
                    待处理 <span style={{color:'#f97316',fontWeight:600}}>{pending}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Detail list for selected carrier */}
          {selected && (
            <div style={card}>
              <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:'8px'}}>
                <div style={{width:'10px',height:'10px',borderRadius:'50%',background:getCarrierColor(selected)}}/>
                <span style={{fontSize:'14px',fontWeight:600,color:'#0f172a'}}>{selected}</span>
                <span style={{fontSize:'12px',color:'#94a3b8'}}>· {groups[selected]?.length} 条</span>
              </div>
              <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
                <thead><tr style={{background:'#f8fafc'}}>
                  {['单号','平台','状态','客户','创建时间'].map(h=>(
                    <th key={h} style={{padding:'9px 16px',color:'#64748b',fontWeight:600,textAlign:'left' as const,borderBottom:'1px solid #f1f5f9',fontSize:'11px'}}>{h}</th>
                  ))}
                </tr></thead>
                <tbody>
                  {groups[selected]?.sort((a,b)=>a.status-b.status).map((t,i)=>(
                    <tr key={t.id} style={{borderBottom:i<groups[selected].length-1?'1px solid #f8fafc':'none'}}>
                      <td style={{padding:'10px 16px',color:'#0f172a',fontWeight:500,fontFamily:'monospace',fontSize:'12px'}}>{t.lingxing_order_no??t.title.replace('【一件代发】','')}</td>
                      <td style={{padding:'10px 16px',color:'#475569'}}>{extractPlatform(t.description)}</td>
                      <td style={{padding:'10px 16px'}}>
                        <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:`${STATUS_COLOR[t.status]}15`,color:STATUS_COLOR[t.status],border:`1px solid ${STATUS_COLOR[t.status]}33`}}>
                          {STATUS_LABEL[t.status]}
                        </span>
                      </td>
                      <td style={{padding:'10px 16px',color:'#94a3b8',fontSize:'12px'}}>{t.customer_code??'-'}</td>
                      <td style={{padding:'10px 16px',color:'#94a3b8',fontSize:'12px'}}>{new Date(t.created_at).toLocaleDateString('zh-CN')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {!selected && (
            <div style={{...card,padding:'24px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>
              点击上方物流商卡片查看该物流商的详细待办列表
            </div>
          )}
        </>
      )}
    </div>
  )
}
