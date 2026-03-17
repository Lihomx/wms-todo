'use client'
import { useState, useEffect } from 'react'

interface Order {
  id:number; customer_code:string; customer_name:string; created_at:string
  dest_name:string; dest_phone:string; dest_address:string; dest_cp:string
  dest_colonia:string; dest_city:string; dest_state:string
  pkg_weight:number; pkg_content:string; logistics_channel:string
  outbound_order_no:string; oms_status:string; oms_error:string
}

const STATUS_COLOR: Record<string,string> = { success:'#16a34a', failed:'#dc2626', pending:'#d97706' }
const STATUS_LABEL: Record<string,string> = { success:'✓ 成功', failed:'✗ 失败', pending:'⏳ 待处理' }

export default function WarehouseShippingPage() {
  const [orders,  setOrders]  = useState<Order[]>([])
  const [loading, setLoading] = useState(true)
  const [total,   setTotal]   = useState(0)
  const [search,  setSearch]  = useState('')
  const [filter,  setFilter]  = useState('')

  useEffect(()=>{
    setLoading(true)
    const p = new URLSearchParams({pageSize:'100'})
    if(filter) p.set('customer', filter)
    fetch(`/api/shipping/orders?${p}`).then(r=>r.json()).then(d=>{
      setOrders(d.orders??[]); setTotal(d.total??0); setLoading(false)
    })
  },[filter])

  const filtered = orders.filter(o=>{
    if(!search) return true
    const s=search.toLowerCase()
    return (o.dest_name||'').toLowerCase().includes(s)
      ||(o.outbound_order_no||'').toLowerCase().includes(s)
      ||(o.dest_cp||'').includes(s)
      ||(o.customer_code||'').includes(s)
  })

  const th:React.CSSProperties={padding:'10px 14px',fontSize:'11px',fontWeight:700,color:'#475569',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',background:'#f8fafc',whiteSpace:'nowrap' as const}
  const td:React.CSSProperties={padding:'10px 14px',fontSize:'12px',color:'#0f172a',borderBottom:'1px solid #f1f5f9',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>打单系统 · 发货记录</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>所有客户创建的出库单记录，共 {total} 条</p>
        </div>
      </div>

      <div style={{display:'flex',gap:'10px',marginBottom:'16px'}}>
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索收件人/出库单号/邮编..."
          style={{padding:'8px 12px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'#fff',fontSize:'13px',color:'#0f172a',outline:'none',width:'280px'}}/>
        <select value={filter} onChange={e=>setFilter(e.target.value)}
          style={{padding:'8px 12px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'#fff',fontSize:'13px',cursor:'pointer',outline:'none'}}>
          <option value="">全部客户</option>
          {[...new Set(orders.map(o=>o.customer_code))].map(c=>(
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      </div>

      <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const}}>
          <thead>
            <tr>
              {['客户','创建时间','收件人','电话','地址','邮编/Colonia','城市/州','重量','物流渠道','出库单号','状态'].map(h=>(
                <th key={h} style={th}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={11} style={{...td,textAlign:'center' as const,padding:'40px',color:'#94a3b8'}}>加载中...</td></tr>
            : filtered.length===0 ? <tr><td colSpan={11} style={{...td,textAlign:'center' as const,padding:'40px',color:'#94a3b8'}}>暂无记录</td></tr>
            : filtered.map((o,i)=>(
              <tr key={o.id} style={{background:i%2===0?'#fff':'#fafbfc'}}>
                <td style={td}><span style={{padding:'2px 7px',borderRadius:'4px',background:'#eff6ff',color:'#2563eb',fontSize:'11px',fontWeight:600}}>{o.customer_code}</span></td>
                <td style={td}>{new Date(o.created_at).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'})}</td>
                <td style={td} title={o.dest_name}>{o.dest_name}</td>
                <td style={td}>{o.dest_phone}</td>
                <td style={{...td,maxWidth:'180px'}} title={o.dest_address}>{o.dest_address}</td>
                <td style={td}>{o.dest_cp} {o.dest_colonia}</td>
                <td style={td}>{o.dest_city}, {o.dest_state}</td>
                <td style={td}>{o.pkg_weight}kg</td>
                <td style={td}>{o.logistics_channel||'-'}</td>
                <td style={{...td,fontFamily:'monospace',fontSize:'11px',color:'#2563eb'}}>
                  {o.outbound_order_no || '-'}
                </td>
                <td style={td}>
                  <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:`${STATUS_COLOR[o.oms_status]||'#94a3b8'}15`,color:STATUS_COLOR[o.oms_status]||'#94a3b8',border:`1px solid ${STATUS_COLOR[o.oms_status]||'#94a3b8'}33`}}>
                    {STATUS_LABEL[o.oms_status]||o.oms_status}
                  </span>
                  {o.oms_error && <div style={{fontSize:'10px',color:'#dc2626',marginTop:'2px'}} title={o.oms_error}>⚠️ {o.oms_error.slice(0,30)}</div>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
