'use client'
import { useState, useEffect, useCallback } from 'react'

function getCC() {
  if(typeof window==='undefined') return ''
  try{const s=sessionStorage.getItem('wms_client_session');if(s){const p=JSON.parse(s);if(p.customerCode)return p.customerCode}}catch{}
  return ''
}

interface InboundOrder {
  inboundOrderNo:string; thirdOrderNo:string; referOrderNo:string
  inboundType:number; inboundTypeName:string
  status:number; statusName?:string
  trackingNo:string; expectedDate:string
  orderCreateTime:string; receivedEndTime:string; shelfEndTime:string
  whCode:string; remark:string
}

// Status: 0-新建 1-待入库 2-收货中 3-已收货 4-已上架 5-已取消
const INBOUND_STATUS: Record<number,{label:string;color:string}> = {
  0:{label:'新建',   color:'#64748b'},
  1:{label:'待入库', color:'#f97316'},
  2:{label:'收货中', color:'#3b82f6'},
  3:{label:'已收货', color:'#8b5cf6'},
  4:{label:'已上架', color:'#16a34a'},
  5:{label:'已取消', color:'#94a3b8'},
}

// Map inboundType to warehouse service category
const SERVICE_TABS = [
  { key:'all',   label:'全部',       icon:'📋', inboundTypes:[] },
  { key:'rep',   label:'常规入库',    icon:'📦', inboundTypes:[1], desc:'一件代发入库' },
  { key:'stock', label:'备货中转入库',icon:'🏭', inboundTypes:[2], desc:'备货中转' },
  { key:'claim', label:'入库认领',    icon:'🔍', inboundTypes:[3], desc:'' },
  { key:'defect',label:'次品处理',    icon:'⚠️', inboundTypes:[],  statusFilter:[3], desc:'' },
  { key:'work',  label:'工单',        icon:'🔧', inboundTypes:[4], desc:'' },
]

export default function ClientWarehousePage() {
  const [orders,   setOrders]   = useState<InboundOrder[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState('')
  const [tab,      setTab]      = useState('all')
  const [page,     setPage]     = useState(1)
  const [total,    setTotal]    = useState(0)
  const [statusF,  setStatusF]  = useState<string>('')
  const [cc,       setCc]       = useState('')

  const load = useCallback(async(customerCode:string, pg:number, status:string, currentTab:string)=>{
    if(!customerCode) return
    setLoading(true); setError('')
    const tabCfg = SERVICE_TABS.find(t=>t.key===currentTab)
    const params = new URLSearchParams({type:'inbound', customerCode, page:String(pg)})
    if(status) params.set('status', status)
    if(tabCfg && tabCfg.inboundTypes.length>0) params.set('inboundType', String(tabCfg.inboundTypes[0]))
    const r = await fetch(`/api/oms-data?${params}`)
    const d = await r.json()
    if(d.error){setError(d.error);setLoading(false);return}
    setOrders(d.items??[]); setTotal(d.total??0); setLoading(false)
  },[])

  useEffect(()=>{
    const code = getCC()
    if(code){setCc(code); load(code,1,'',tab); return}
    fetch('/api/auth-info').then(r=>r.json()).then(d=>{
      setCc(d.customerCode||''); load(d.customerCode||'',1,'',tab)
    })
  },[load, tab])

  const changePage = (p:number)=>{ setPage(p); load(cc,p,statusF,tab) }
  const changeStatus = (s:string)=>{ setStatusF(s); setPage(1); load(cc,1,s,tab) }
  const changeTab = (t:string)=>{ setTab(t); setPage(1); setStatusF(''); load(cc,1,'',t) }

  const totalPages = Math.ceil(total/20)

  const th:React.CSSProperties={padding:'10px 14px',fontSize:'11px',fontWeight:700,color:'#475569',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap' as const,background:'#f8fafc',position:'sticky' as const,top:0}
  const td:React.CSSProperties={padding:'10px 14px',fontSize:'12px',color:'#0f172a',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap' as const}

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden',background:'#f8fafc'}}>
      {/* Header */}
      <div style={{padding:'16px 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
          <div>
            <h1 style={{fontSize:'18px',fontWeight:700,color:'#0f172a'}}>仓库服务 · 入库</h1>
            <p style={{fontSize:'12px',color:'#64748b',marginTop:'2px'}}>共 {loading?'…':total} 条 · 近180天</p>
          </div>
          <select value={statusF} onChange={e=>changeStatus(e.target.value)}
            style={{padding:'7px 11px',borderRadius:'7px',border:'1px solid #e2e8f0',fontSize:'12px',outline:'none',cursor:'pointer'}}>
            <option value="">全部状态</option>
            {Object.entries(INBOUND_STATUS).map(([k,v])=>(
              <option key={k} value={k}>{v.label}</option>
            ))}
          </select>
        </div>
        {/* Service tabs - matches screenshot sidebar */}
        <div style={{display:'flex',gap:'0',overflowX:'auto' as const}}>
          {SERVICE_TABS.map(t=>{
            const active = tab===t.key
            return (
              <button key={t.key} onClick={()=>changeTab(t.key)}
                style={{padding:'9px 16px',border:'none',borderBottom:`2px solid ${active?'#2563eb':'transparent'}`,background:'none',color:active?'#2563eb':'#64748b',fontSize:'13px',fontWeight:active?600:400,cursor:'pointer',whiteSpace:'nowrap' as const,display:'flex',alignItems:'center',gap:'5px'}}>
                <span>{t.icon}</span><span>{t.label}</span>
                {t.desc&&<span style={{fontSize:'10px',color:'#94a3b8'}}>({t.desc})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {error && <div style={{padding:'14px',color:'#dc2626',background:'#fef2f2',borderRadius:'8px',marginBottom:'14px',fontSize:'13px'}}>{error}</div>}
        <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
          <table style={{width:'100%',borderCollapse:'collapse' as const}}>
            <thead>
              <tr>
                <th style={th}>入库单号</th>
                <th style={th}>产品数量</th>
                <th style={th}>SKU·数量</th>
                <th style={th}>箱数</th>
                <th style={th}>仓库</th>
                <th style={th}>入库类型</th>
                <th style={th}>货柜号/跟踪号</th>
                <th style={th}>参考单号</th>
                <th style={th}>到仓方式</th>
                <th style={th}>状态</th>
                <th style={th}>创建时间</th>
              </tr>
            </thead>
            <tbody>
              {loading
                ? <tr><td colSpan={11} style={{...td,textAlign:'center' as const,color:'#94a3b8',padding:'40px'}}>加载中...</td></tr>
                : orders.length===0
                ? <tr><td colSpan={11} style={{...td,textAlign:'center' as const,color:'#94a3b8',padding:'40px'}}>暂无入库单</td></tr>
                : orders.map((o,i)=>{
                  const st = INBOUND_STATUS[o.status] ?? {label:'未知',color:'#94a3b8'}
                  return (
                    <tr key={o.inboundOrderNo} style={{background:i%2===0?'#fff':'#fafbfc'}}>
                      <td style={{...td,color:'#2563eb',fontWeight:600,fontFamily:'monospace',fontSize:'11px'}}>{o.inboundOrderNo}</td>
                      <td style={td}>-</td>
                      <td style={td}>-</td>
                      <td style={td}>-</td>
                      <td style={{...td,color:'#64748b',fontSize:'11px'}}>{o.whCode} 仓库1 ({o.whCode})</td>
                      <td style={td}><span style={{fontSize:'11px',color:'#475569'}}>{o.inboundTypeName||(['','一件代发','备货中转'][o.inboundType]||o.inboundType)}</span></td>
                      <td style={{...td,fontFamily:'monospace',fontSize:'11px',color:'#2563eb',maxWidth:'160px',overflow:'hidden',textOverflow:'ellipsis'}}>{o.trackingNo||'-'}</td>
                      <td style={{...td,color:'#64748b',fontSize:'11px'}}>{o.referOrderNo||'-'}</td>
                      <td style={td}><span style={{fontSize:'11px',color:'#64748b'}}>快递包</span></td>
                      <td style={td}>
                        <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:`${st.color}15`,color:st.color,border:`1px solid ${st.color}30`}}>
                          {o.statusName||st.label}
                        </span>
                      </td>
                      <td style={{...td,color:'#94a3b8',fontSize:'11px'}}>
                        {o.orderCreateTime ? new Date(o.orderCreateTime).toLocaleString('zh-CN',{month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'}
                      </td>
                    </tr>
                  )
                })}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div style={{display:'flex',alignItems:'center',justifyContent:'flex-end',gap:'6px',marginTop:'14px',fontSize:'13px',color:'#64748b'}}>
            <span>共{total}条</span>
            <button onClick={()=>changePage(Math.max(1,page-1))} disabled={page===1} style={{padding:'4px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:'#fff',cursor:page===1?'not-allowed':'pointer',color:page===1?'#d1d5db':'#475569'}}>‹</button>
            {Array.from({length:Math.min(totalPages,5)},(_,i)=>i+1).map(p=>(
              <button key={p} onClick={()=>changePage(p)} style={{padding:'4px 10px',borderRadius:'5px',border:`1px solid ${page===p?'#2563eb':'#e2e8f0'}`,background:page===p?'#2563eb':'#fff',color:page===p?'white':'#475569',cursor:'pointer',fontWeight:page===p?600:400}}>{p}</button>
            ))}
            <button onClick={()=>changePage(Math.min(totalPages,page+1))} disabled={page===totalPages} style={{padding:'4px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:'#fff',cursor:page===totalPages?'not-allowed':'pointer',color:page===totalPages?'#d1d5db':'#475569'}}>›</button>
          </div>
        )}
      </div>
    </div>
  )
}
