'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Todo {
  id: string; title: string; description: string|null; status: number
  customer_code: string|null; category: string; created_at: string
  lingxing_order_no: string|null; extra_data: Record<string,any>|null
}

// ── Column definitions ──────────────────────────────────────
interface ColDef { key: string; label: string; width?: number; render: (t: Todo) => string|number|React.ReactNode }

const STATUS_LABEL = ['待处理','进行中','已完成','已取消']
const STATUS_COLOR = ['#f97316','#3b82f6','#22c55e','#64748b']

const ALL_COLS: ColDef[] = [
  { key:'outboundOrderNo',  label:'出库单号',    width:160, render: t => t.lingxing_order_no??'-' },
  { key:'status',           label:'状态',        width:80,  render: t => <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:`${STATUS_COLOR[t.status]}15`,color:STATUS_COLOR[t.status],border:`1px solid ${STATUS_COLOR[t.status]}33`}}>{STATUS_LABEL[t.status]}</span> },
  { key:'salesPlatform',    label:'销售平台',    width:100, render: t => t.extra_data?.salesPlatform||'-' },
  { key:'logisticsChannel', label:'物流渠道',    width:180, render: t => t.extra_data?.logisticsChannel||'-' },
  { key:'logisticsCarrier', label:'物流承运商',  width:120, render: t => t.extra_data?.logisticsCarrier||'-' },
  { key:'logisticsTrackNo', label:'物流跟踪号',  width:160, render: t => t.extra_data?.logisticsTrackNo||'-' },
  { key:'receiver',         label:'收件人',      width:100, render: t => t.extra_data?.receiver||'-' },
  { key:'countryRegionCode',label:'国家',        width:60,  render: t => t.extra_data?.countryRegionCode||'-' },
  { key:'provinceName',     label:'省/州',       width:100, render: t => t.extra_data?.provinceName||'-' },
  { key:'cityName',         label:'城市',        width:80,  render: t => t.extra_data?.cityName||'-' },
  { key:'postCode',         label:'邮编',        width:80,  render: t => t.extra_data?.postCode||'-' },
  { key:'warehouseCode',    label:'仓库',        width:80,  render: t => t.extra_data?.warehouseCode||'-' },
  { key:'customer_code',    label:'客户',        width:80,  render: t => t.customer_code||'-' },
  { key:'productQty',       label:'产品数量',    width:80,  render: t => {
    const list = t.extra_data?.productList??[]
    return list.reduce((s:number,p:any)=>s+(p.quantity??0),0)||'-'
  }},
  { key:'productSku',       label:'SKU',         width:200, render: t => {
    const list = t.extra_data?.productList??[]
    return list.slice(0,2).map((p:any)=>`${p.sku}×${p.quantity}`).join(', ')+(list.length>2?`...+${list.length-2}`:'')
  }},
  { key:'referOrderNo',     label:'参考单号',    width:130, render: t => t.extra_data?.referOrderNo||'-' },
  { key:'platformOrderNo',  label:'平台单号',    width:130, render: t => t.extra_data?.platformOrderNo||'-' },
  { key:'costTotal',        label:'费用',        width:80,  render: t => t.extra_data?.costTotal ? `${t.extra_data.costTotal} ${t.extra_data.costCurrencyCode||''}` : '-' },
  { key:'orderCreateTime',  label:'创建时间',    width:150, render: t => {
    const d = t.extra_data?.orderCreateTime||t.created_at
    return d ? new Date(d).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'
  }},
  { key:'outboundTime',     label:'出库时间',    width:150, render: t => {
    const d = t.extra_data?.outboundTime
    return d ? new Date(d).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) : '-'
  }},
  { key:'remark',           label:'备注',        width:120, render: t => t.extra_data?.remark||'-' },
]

const DEFAULT_COLS = ['outboundOrderNo','status','logisticsChannel','logisticsTrackNo','salesPlatform','receiver','countryRegionCode','productQty','customer_code','orderCreateTime']

export default function OutboundDetailPage() {
  const [todos,       setTodos]       = useState<Todo[]>([])
  const [loading,     setLoading]     = useState(true)
  const [showPicker,  setShowPicker]  = useState(false)
  const [visibleCols, setVisibleCols] = useState<string[]>(() => {
    if (typeof window === 'undefined') return DEFAULT_COLS
    try { return JSON.parse(localStorage.getItem('outbound-cols')||'null') || DEFAULT_COLS } catch { return DEFAULT_COLS }
  })
  const [colOrder,    setColOrder]    = useState<string[]>(visibleCols)
  const [dragCol,     setDragCol]     = useState<string|null>(null)
  const [dragOver,    setDragOver]    = useState<string|null>(null)
  const [search,      setSearch]      = useState('')
  const [statusFilter,setStatusFilter]= useState('')

  const saveColPrefs = useCallback((cols: string[]) => {
    setVisibleCols(cols); setColOrder(cols)
    localStorage.setItem('outbound-cols', JSON.stringify(cols))
  }, [])

  useEffect(() => {
    const p = new URLSearchParams({pageSize:'500', category:'出库作业'})
    if (statusFilter) p.set('status', statusFilter)
    fetch(`/api/todos?${p}`).then(r=>r.json()).then(d=>{ setTodos(d.todos??[]); setLoading(false) })
  }, [statusFilter])

  // Drag to reorder columns
  const onDragStart = (key: string) => setDragCol(key)
  const onDragOver  = (e: React.DragEvent, key: string) => { e.preventDefault(); setDragOver(key) }
  const onDrop      = (key: string) => {
    if (!dragCol || dragCol===key) return
    const order = [...colOrder]
    const from  = order.indexOf(dragCol)
    const to    = order.indexOf(key)
    order.splice(from,1); order.splice(to,0,dragCol)
    saveColPrefs(order)
    setDragCol(null); setDragOver(null)
  }

  const filtered = todos.filter(t => !search || t.lingxing_order_no?.includes(search) || t.extra_data?.receiver?.includes(search) || t.extra_data?.logisticsTrackNo?.includes(search))
  const activeCols = colOrder.filter(k => visibleCols.includes(k))
  const colDef = (key: string) => ALL_COLS.find(c=>c.key===key)!

  const thStyle: React.CSSProperties = {
    padding:'10px 12px', fontSize:'12px', fontWeight:600, color:'#475569',
    textAlign:'left' as const, borderBottom:'2px solid #e2e8f0', whiteSpace:'nowrap' as const,
    background:'#f8fafc', position:'sticky' as const, top:0, zIndex:1, cursor:'grab',
    userSelect:'none' as const,
  }
  const tdStyle: React.CSSProperties = {
    padding:'9px 12px', fontSize:'13px', color:'#0f172a',
    borderBottom:'1px solid #f1f5f9', whiteSpace:'nowrap' as const, maxWidth:'220px',
    overflow:'hidden', textOverflow:'ellipsis',
  }

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden',background:'#f8fafc'}}>
      {/* Header */}
      <div style={{padding:'16px 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',display:'flex',alignItems:'center',gap:'12px',flexShrink:0}}>
        <Link href="/warehouse/dashboard" style={{color:'#94a3b8',textDecoration:'none',fontSize:'13px',flexShrink:0}}>← 返回总览</Link>
        <span style={{color:'#e2e8f0'}}>/</span>
        <h1 style={{fontSize:'16px',fontWeight:700,color:'#0f172a',flexShrink:0}}>一件代发 · 按物流商明细</h1>
        <span style={{padding:'2px 10px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'12px',fontWeight:600,border:'1px solid #bfdbfe',flexShrink:0}}>
          {loading?'…':filtered.length} 条
        </span>
        <div style={{flex:1}}/>

        {/* Search */}
        <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索单号/跟踪号/收件人..."
          style={{padding:'7px 12px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'13px',color:'#0f172a',outline:'none',width:'220px'}}/>

        {/* Status filter */}
        <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
          style={{padding:'7px 10px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'13px',color:'#0f172a',cursor:'pointer',outline:'none'}}>
          <option value="">全部状态</option>
          {STATUS_LABEL.map((l,i)=><option key={i} value={i}>{l}</option>)}
        </select>

        {/* Column picker */}
        <button onClick={()=>setShowPicker(s=>!s)}
          style={{padding:'7px 14px',borderRadius:'7px',border:'1px solid #e2e8f0',background:showPicker?'#eff6ff':'#fff',color:showPicker?'#2563eb':'#475569',fontSize:'12px',fontWeight:500,cursor:'pointer',flexShrink:0}}>
          ⚙ 选择列 ({visibleCols.length})
        </button>
      </div>

      {/* Column picker panel */}
      {showPicker && (
        <div style={{padding:'16px 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
          <div style={{fontSize:'12px',fontWeight:600,color:'#0f172a',marginBottom:'10px'}}>
            选择显示列（拖动表头可调整顺序）
          </div>
          <div style={{display:'flex',flexWrap:'wrap' as const,gap:'8px'}}>
            {ALL_COLS.map(col=>{
              const on = visibleCols.includes(col.key)
              return (
                <label key={col.key} style={{display:'flex',alignItems:'center',gap:'5px',padding:'5px 10px',borderRadius:'6px',cursor:'pointer',background:on?'#eff6ff':'#f8fafc',border:`1px solid ${on?'#bfdbfe':'#e2e8f0'}`,fontSize:'12px',color:on?'#2563eb':'#475569',fontWeight:on?500:400,userSelect:'none' as const}}>
                  <input type="checkbox" checked={on} onChange={e=>{
                    const next = e.target.checked ? [...visibleCols, col.key] : visibleCols.filter(k=>k!==col.key)
                    // Maintain order
                    const ordered = ALL_COLS.map(c=>c.key).filter(k=>next.includes(k))
                    saveColPrefs(ordered)
                  }} style={{accentColor:'#2563eb'}}/>
                  {col.label}
                </label>
              )
            })}
          </div>
          <div style={{marginTop:'10px',display:'flex',gap:'8px'}}>
            <button onClick={()=>saveColPrefs(ALL_COLS.map(c=>c.key))} style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'12px',cursor:'pointer'}}>全选</button>
            <button onClick={()=>saveColPrefs(DEFAULT_COLS)} style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'12px',cursor:'pointer'}}>恢复默认</button>
          </div>
        </div>
      )}

      {/* Table */}
      <div style={{flex:1,overflow:'auto'}}>
        {loading ? (
          <div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8',fontSize:'14px'}}>加载中...</div>
        ) : filtered.length===0 ? (
          <div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8',fontSize:'14px'}}>
            {search?'未找到匹配数据':'暂无出库数据，请先在客户管理页同步数据'}
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
            <thead>
              <tr>
                {activeCols.map(key=>{
                  const col = colDef(key)
                  if (!col) return null
                  return (
                    <th key={key} style={{...thStyle,background:dragOver===key?'#dbeafe':thStyle.background,minWidth:`${col.width??100}px`}}
                      draggable onDragStart={()=>onDragStart(key)} onDragOver={e=>onDragOver(e,key)} onDrop={()=>onDrop(key)} onDragEnd={()=>{setDragCol(null);setDragOver(null)}}>
                      <span style={{display:'flex',alignItems:'center',gap:'4px'}}>
                        <span style={{color:'#cbd5e1',fontSize:'10px'}}>⠿</span>
                        {col.label}
                      </span>
                    </th>
                  )
                })}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t,i)=>(
                <tr key={t.id} style={{background:i%2===0?'#fff':'#fafbfc'}}>
                  {activeCols.map(key=>{
                    const col = colDef(key)
                    if (!col) return null
                    return <td key={key} style={tdStyle}>{col.render(t)}</td>
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
