'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Todo { id:string; title:string; category:string; status:number; description:string|null; customer_code:string|null }

function extractLogistics(desc: string|null): string {
  if (!desc) return '未知'
  const m = desc.match(/物流：([^|]+)/)
  if (m) return m[1].trim()
  return '其他'
}

export default function WarehouseDashboard() {
  const [todos,   setTodos]   = useState<Todo[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(()=>{
    fetch('/api/todos?pageSize=500').then(r=>r.json()).then(d=>{
      setTodos(d.todos??[]); setLoading(false)
    })
  },[])

  const byCategory = (cat: string, statuses?: number[]) => {
    const filtered = todos.filter(t => t.category === cat)
    if (!statuses) return filtered
    return filtered.filter(t => statuses.includes(t.status))
  }

  // Inbound
  const inboundPending = byCategory('入库作业', [0]).length

  // Outbound - one by one delivery
  const outboundAll    = byCategory('出库作业')
  const outboundPending = outboundAll.filter(t=>t.status===0).length

  // Inventory
  const inventoryAll    = byCategory('库存管理')
  const inventoryPending = inventoryAll.filter(t=>t.status===0).length

  // Returns / 退货
  const returnsAll    = byCategory('退货处理')
  const returnsPending = returnsAll.filter(t=>t.status===0).length

  // Big outbound (备货中转 - stored differently, check title)
  const bigOutboundAll    = todos.filter(t=>t.title.includes('【大货】')||t.title.includes('备货中转'))
  const bigOutboundPending = bigOutboundAll.filter(t=>t.status===0).length

  // Logistics carrier breakdown for outbound
  const carrierMap: Record<string, number> = {}
  outboundAll.forEach(t => {
    const c = extractLogistics(t.description)
    carrierMap[c] = (carrierMap[c]||0) + 1
  })
  const topCarriers = Object.entries(carrierMap).sort((a,b)=>b[1]-a[1]).slice(0,6)

  const card:React.CSSProperties = {background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'20px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}
  const statCard = (label:string, sub:string, value:number|string, href?:string, highlight=false) => (
    <div style={{...card,flex:1,minWidth:0}} key={label}>
      <div style={{fontSize:'12px',color:'#64748b',fontWeight:500,marginBottom:'2px'}}>{label}</div>
      <div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'8px'}}>{sub}</div>
      <div style={{fontSize:'28px',fontWeight:800,color:highlight&&Number(value)>0?'#f97316':'#0f172a',lineHeight:1}}>
        {loading ? '…' : value}
      </div>
      {href && <Link href={href} style={{fontSize:'11px',color:'#2563eb',textDecoration:'none',display:'block',marginTop:'8px'}}>查看明细 →</Link>}
    </div>
  )

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>仓库总览</h1>
        <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>{new Date().toLocaleDateString('zh-CN',{year:'numeric',month:'long',day:'numeric',weekday:'long'})}</p>
      </div>

      {/* Main stat cards - matching screenshot layout */}
      <div style={{...card,padding:'24px',marginBottom:'16px'}}>
        <div style={{display:'flex',gap:'0',borderRadius:'8px',overflow:'hidden'}}>

          {/* 产品审核 */}
          <div style={{flex:1,padding:'16px 20px',borderRight:'1px solid #f1f5f9'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'8px'}}>产品审核</div>
            <div style={{fontSize:'12px',color:'#94a3b8'}}>待审核</div>
            <div style={{fontSize:'28px',fontWeight:800,color:'#0f172a',lineHeight:1.2}}>{loading?'…':0}</div>
          </div>

          {/* 入库 */}
          <div style={{flex:1,padding:'16px 20px',borderRight:'1px solid #f1f5f9'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'8px'}}>入库</div>
            <div style={{fontSize:'12px',color:'#94a3b8'}}>待入库</div>
            <div style={{fontSize:'28px',fontWeight:800,color:inboundPending>0?'#f97316':'#0f172a',lineHeight:1.2}}>{loading?'…':inboundPending}</div>
            <Link href="/warehouse/todos?category=入库作业" style={{fontSize:'11px',color:'#2563eb',textDecoration:'none',marginTop:'4px',display:'block'}}>查看 →</Link>
          </div>

          {/* 出库 - 一件代发 + 备货中转 */}
          <div style={{flex:2,padding:'16px 20px',borderRight:'1px solid #f1f5f9'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'8px'}}>出库</div>
            <div style={{display:'flex',gap:'32px'}}>
              <div>
                <div style={{fontSize:'12px',color:'#94a3b8'}}>一件代发</div>
                <Link href="/warehouse/outbound" style={{textDecoration:'none'}}>
                  <div style={{fontSize:'28px',fontWeight:800,color:outboundPending>0?'#f97316':'#2563eb',lineHeight:1.2,cursor:'pointer',textDecoration:'underline',textDecorationColor:'#bfdbfe'}}>{loading?'…':outboundAll.length}</div>
                </Link>
                <div style={{fontSize:'11px',color:'#94a3b8',marginTop:'2px'}}>待处理 <span style={{color:'#f97316',fontWeight:600}}>{outboundPending}</span></div>
              </div>
              <div>
                <div style={{fontSize:'12px',color:'#94a3b8'}}>备货中转</div>
                <div style={{fontSize:'28px',fontWeight:800,color:'#0f172a',lineHeight:1.2}}>{loading?'…':bigOutboundAll.length}</div>
              </div>
            </div>
          </div>

          {/* 截单 */}
          <div style={{flex:1,padding:'16px 20px',borderRight:'1px solid #f1f5f9'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'8px'}}>截单</div>
            <div style={{fontSize:'12px',color:'#94a3b8'}}>待处理</div>
            <div style={{fontSize:'28px',fontWeight:800,color:'#0f172a',lineHeight:1.2}}>{loading?'…':0}</div>
          </div>

          {/* 退件 */}
          <div style={{flex:1,padding:'16px 20px',borderRight:'1px solid #f1f5f9'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'8px'}}>退件</div>
            <div style={{fontSize:'12px',color:'#94a3b8'}}>待入库</div>
            <div style={{fontSize:'28px',fontWeight:800,color:returnsPending>0?'#f97316':'#0f172a',lineHeight:1.2}}>{loading?'…':returnsPending}</div>
            <Link href="/warehouse/todos?category=退货处理" style={{fontSize:'11px',color:'#2563eb',textDecoration:'none',marginTop:'4px',display:'block'}}>查看 →</Link>
          </div>

          {/* 转运 */}
          <div style={{flex:1,padding:'16px 20px'}}>
            <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'8px'}}>转运</div>
            <div style={{fontSize:'12px',color:'#94a3b8'}}>待收货</div>
            <div style={{fontSize:'28px',fontWeight:800,color:'#0f172a',lineHeight:1.2}}>{loading?'…':0}</div>
          </div>
        </div>
      </div>

      {/* Second row: Outbound by carrier + quick actions */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'14px'}}>

        {/* Outbound by carrier */}
        <div style={card}>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
            <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>🚚 一件代发 · 物流商明细</span>
            <Link href="/warehouse/outbound" style={{fontSize:'12px',color:'#2563eb',textDecoration:'none',fontWeight:500}}>查看全部 →</Link>
          </div>
          {loading ? <div style={{color:'#94a3b8',fontSize:'13px'}}>加载中...</div>
          : topCarriers.length===0 ? <div style={{color:'#94a3b8',fontSize:'13px'}}>暂无数据，请先同步</div>
          : topCarriers.map(([carrier, count])=>(
            <div key={carrier} style={{display:'flex',alignItems:'center',gap:'10px',padding:'8px 0',borderBottom:'1px solid #f8fafc'}}>
              <div style={{flex:1}}>
                <div style={{fontSize:'13px',fontWeight:500,color:'#0f172a'}}>{carrier}</div>
              </div>
              <div style={{fontSize:'16px',fontWeight:700,color:'#0f172a',minWidth:'36px',textAlign:'right' as const}}>{count}</div>
              <div style={{width:'80px',height:'6px',background:'#f1f5f9',borderRadius:'3px',overflow:'hidden'}}>
                <div style={{width:`${Math.round(count/outboundAll.length*100)}%`,height:'100%',background:'#2563eb',borderRadius:'3px'}}/>
              </div>
            </div>
          ))}
        </div>

        {/* Inventory warnings + quick actions */}
        <div style={{display:'flex',flexDirection:'column' as const,gap:'12px'}}>
          <div style={card}>
            <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
              <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>📦 库存预警</span>
              <Link href="/warehouse/todos?category=库存管理" style={{fontSize:'12px',color:'#2563eb',textDecoration:'none'}}>查看全部 →</Link>
            </div>
            <div style={{display:'flex',gap:'16px'}}>
              <div>
                <div style={{fontSize:'11px',color:'#94a3b8'}}>预警SKU</div>
                <div style={{fontSize:'24px',fontWeight:800,color:inventoryPending>0?'#dc2626':'#0f172a'}}>{loading?'…':inventoryPending}</div>
              </div>
              <div>
                <div style={{fontSize:'11px',color:'#94a3b8'}}>已处理</div>
                <div style={{fontSize:'24px',fontWeight:800,color:'#16a34a'}}>{loading?'…':inventoryAll.filter(t=>t.status===2).length}</div>
              </div>
            </div>
          </div>
          <div style={{...card,padding:'14px 16px'}}>
            <div style={{fontSize:'12px',fontWeight:600,color:'#0f172a',marginBottom:'8px'}}>快速操作</div>
            <div style={{display:'flex',gap:'7px',flexWrap:'wrap' as const}}>
              {[
                {href:'/warehouse/clients', label:'同步客户数据', icon:'⟳'},
                {href:'/warehouse/todos',   label:'全部待办',    icon:'✓'},
                {href:'/warehouse/staff',   label:'员工管理',    icon:'👤'},
              ].map(l=>(
                <Link key={l.href} href={l.href} style={{padding:'6px 12px',borderRadius:'6px',background:'#f8fafc',border:'1px solid #e2e8f0',color:'#475569',textDecoration:'none',fontSize:'12px',fontWeight:500}}>
                  {l.icon} {l.label}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
