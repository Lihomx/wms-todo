'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

interface Todo {
  id: string; title: string; description: string|null; status: number
  customer_code: string|null; category: string; created_at: string
  lingxing_order_no: string|null; extra_data: Record<string,any>|null
}

const STATUS_LABEL = ['待处理','进行中','已完成','已取消']
const STATUS_COLOR = ['#f97316','#3b82f6','#22c55e','#64748b']

const fmtDate = (d: string|null|undefined) => {
  if (!d) return '-'
  try { return new Date(d).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit'}) }
  catch { return d }
}

type ColDef = { key:string; label:string; width:number; render:(t:Todo)=>any }

const ALL_COLS: ColDef[] = [
  { key:'outboundOrderNo',   label:'出库单号',   width:170, render:t=>t.lingxing_order_no??'-' },
  { key:'status',            label:'状态',       width:90,  render:t=><span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:`${STATUS_COLOR[t.status]}15`,color:STATUS_COLOR[t.status],border:`1px solid ${STATUS_COLOR[t.status]}33`}}>{STATUS_LABEL[t.status]}</span> },
  { key:'salesPlatform',     label:'销售平台',   width:110, render:t=>t.extra_data?.salesPlatform||'-' },
  { key:'logisticsChannel',  label:'物流渠道',   width:200, render:t=>t.extra_data?.logisticsChannel||'-' },
  { key:'logisticsTrackNo',  label:'物流跟踪号', width:170, render:t=>{
    const nos = t.extra_data?.logisticsTrackNos
    if(Array.isArray(nos)&&nos.length>0) return nos.join(', ')
    return t.extra_data?.logisticsTrackNo||'-'
  }},
  { key:'receiver',          label:'收件人',     width:110, render:t=>t.extra_data?.receiver||'-' },
  { key:'telephone',         label:'电话',       width:130, render:t=>t.extra_data?.telephone||'-' },
  { key:'companyName',       label:'公司',       width:130, render:t=>t.extra_data?.companyName||'-' },
  { key:'countryRegionCode', label:'国家',       width:65,  render:t=>t.extra_data?.countryRegionCode||'-' },
  { key:'countryRegionName', label:'国家名称',   width:100, render:t=>t.extra_data?.countryRegionName||'-' },
  { key:'provinceName',      label:'省/州',      width:100, render:t=>t.extra_data?.provinceName||'-' },
  { key:'cityName',          label:'城市',       width:90,  render:t=>t.extra_data?.cityName||'-' },
  { key:'postCode',          label:'邮编',       width:80,  render:t=>t.extra_data?.postCode||'-' },
  { key:'addressOne',        label:'地址',       width:200, render:t=>t.extra_data?.addressOne||'-' },
  { key:'whCode',            label:'仓库',       width:80,  render:t=>t.extra_data?.whCode||'-' },
  { key:'customer_code',     label:'客户',       width:80,  render:t=>t.customer_code||'-' },
  { key:'productQty',        label:'产品数量',   width:80,  render:t=>{
    const list = t.extra_data?.productList??[]
    const qty  = list.reduce((s:number,p:any)=>s+(Number(p.quantity)||0),0)
    return qty || '-'
  }},
  { key:'productSku',        label:'SKU明细',    width:220, render:t=>{
    const list = t.extra_data?.productList??[]
    if(!list.length) return '-'
    return list.slice(0,3).map((p:any)=>`${p.sku}×${p.quantity}`).join(' / ')+(list.length>3?` +${list.length-3}`:'')
  }},
  { key:'productName',       label:'产品名称',   width:160, render:t=>{
    const list = t.extra_data?.productList??[]
    if(!list.length) return '-'
    return list.map((p:any)=>p.productName).filter(Boolean).join(', ')||'-'
  }},
  { key:'pkgInfo',           label:'包裹信息',   width:150, render:t=>{
    const list = t.extra_data?.expressList??[]
    if(!list.length) return '-'
    return list.slice(0,2).map((e:any)=>e.pkgSkuNumInfo||`${e.weight??'?'}kg`).join(', ')
  }},
  { key:'referOrderNo',      label:'参考单号',   width:130, render:t=>t.extra_data?.referOrderNo||'-' },
  { key:'platformOrderNo',   label:'平台单号',   width:130, render:t=>t.extra_data?.platformOrderNo||'-' },
  { key:'costTotal',         label:'费用',       width:90,  render:t=>t.extra_data?.costTotal ? `${t.extra_data.costTotal} ${t.extra_data.costCurrencyCode||''}`.trim() : '-' },
  { key:'remark',            label:'备注',       width:120, render:t=>t.extra_data?.remark||'-' },
  { key:'exceptionDesc',     label:'异常原因',   width:150, render:t=>t.extra_data?.exceptionDesc||'-' },
  { key:'orderCreateTime',   label:'创建时间',   width:160, render:t=>fmtDate(t.extra_data?.orderCreateTime||t.created_at) },
  { key:'outboundTime',      label:'出库时间',   width:160, render:t=>fmtDate(t.extra_data?.outboundTime) },
  { key:'interceptTime',     label:'拦截时间',   width:160, render:t=>fmtDate(t.extra_data?.interceptTime) },
  { key:'canceledTime',      label:'取消时间',   width:160, render:t=>fmtDate(t.extra_data?.canceledTime) },
]

const DEFAULT_COLS = ['outboundOrderNo','status','salesPlatform','logisticsChannel','logisticsTrackNo','receiver','countryRegionCode','productQty','productSku','customer_code','orderCreateTime']

export default function OutboundDetailPage() {
  const [todos,        setTodos]        = useState<Todo[]>([])
  const [loading,      setLoading]      = useState(true)
  const [showPicker,   setShowPicker]   = useState(false)
  const [visibleCols,  setVisibleCols]  = useState<string[]>(DEFAULT_COLS)
  const [search,       setSearch]       = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [dragCol,      setDragCol]      = useState<string|null>(null)
  const [dragOver,     setDragOver]     = useState<string|null>(null)

  // Load saved col prefs
  useEffect(()=>{
    try {
      const saved = localStorage.getItem('wms-outbound-cols')
      if(saved) setVisibleCols(JSON.parse(saved))
    } catch {}
  },[])

  const savePrefs = useCallback((cols:string[])=>{
    setVisibleCols(cols)
    try { localStorage.setItem('wms-outbound-cols', JSON.stringify(cols)) } catch {}
  },[])

  useEffect(()=>{
    setLoading(true)
    const p = new URLSearchParams({pageSize:'500', category:'出库作业'})
    if(statusFilter) p.set('status', statusFilter)
    fetch(`/api/todos?${p}`).then(r=>r.json()).then(d=>{
      setTodos(d.todos??[]); setLoading(false)
    })
  },[statusFilter])

  // Drag-to-reorder columns
  const onDrop = (toKey:string)=>{
    if(!dragCol||dragCol===toKey) return
    const order = [...visibleCols]
    const from  = order.indexOf(dragCol)
    const to    = order.indexOf(toKey)
    if(from===-1||to===-1) return
    order.splice(from,1); order.splice(to,0,dragCol)
    savePrefs(order); setDragCol(null); setDragOver(null)
  }

  const filtered = todos.filter(t=>{
    if(!search) return true
    const s = search.toLowerCase()
    return (t.lingxing_order_no||'').toLowerCase().includes(s) ||
           (t.extra_data?.receiver||'').toLowerCase().includes(s) ||
           (t.extra_data?.logisticsTrackNo||'').toLowerCase().includes(s) ||
           (t.extra_data?.logisticsChannel||'').toLowerCase().includes(s) ||
           (t.extra_data?.countryRegionCode||'').toLowerCase().includes(s)
  })

  const activeCols = visibleCols.map(k=>ALL_COLS.find(c=>c.key===k)).filter(Boolean) as ColDef[]

  const hasNoExtraData = todos.length > 0 && todos.every(t => !t.extra_data || Object.keys(t.extra_data).length === 0)

  const th: React.CSSProperties = {
    padding:'10px 12px', fontSize:'11px', fontWeight:700, color:'#475569',
    textAlign:'left' as const, borderBottom:'2px solid #e2e8f0', whiteSpace:'nowrap' as const,
    background:'#f8fafc', position:'sticky' as const, top:0, zIndex:2,
    cursor:'grab', userSelect:'none' as const,
  }
  const td: React.CSSProperties = {
    padding:'9px 12px', fontSize:'12px', color:'#0f172a',
    borderBottom:'1px solid #f1f5f9', whiteSpace:'nowrap' as const,
    maxWidth:'220px', overflow:'hidden', textOverflow:'ellipsis',
  }

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden',background:'#f8fafc'}}>
      {/* Header */}
      <div style={{padding:'14px 20px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'10px',marginBottom:'10px'}}>
          <Link href="/warehouse/dashboard" style={{color:'#94a3b8',textDecoration:'none',fontSize:'13px'}}>← 返回</Link>
          <span style={{color:'#e2e8f0'}}>/</span>
          <h1 style={{fontSize:'15px',fontWeight:700,color:'#0f172a'}}>一件代发 · 出库明细</h1>
          <span style={{padding:'1px 8px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'11px',fontWeight:600,border:'1px solid #bfdbfe'}}>{loading?'…':filtered.length} 条</span>
          <div style={{flex:1}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索单号/跟踪号/收件人/物流/国家..."
            style={{padding:'6px 12px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',color:'#0f172a',outline:'none',width:'260px'}}/>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)}
            style={{padding:'6px 10px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',cursor:'pointer',outline:'none'}}>
            <option value="">全部状态</option>
            {STATUS_LABEL.map((l,i)=><option key={i} value={i}>{l}</option>)}
          </select>
          <button onClick={()=>setShowPicker(s=>!s)}
            style={{padding:'6px 12px',borderRadius:'6px',border:`1px solid ${showPicker?'#bfdbfe':'#e2e8f0'}`,background:showPicker?'#eff6ff':'#fff',color:showPicker?'#2563eb':'#475569',fontSize:'12px',cursor:'pointer',fontWeight:500,flexShrink:0}}>
            ⚙ 列设置 ({visibleCols.length})
          </button>
        </div>

        {/* Column picker */}
        {showPicker && (
          <div style={{paddingTop:'10px',borderTop:'1px solid #f1f5f9'}}>
            <div style={{fontSize:'11px',color:'#64748b',marginBottom:'8px'}}>勾选显示的列 · 拖动表头可调整顺序</div>
            <div style={{display:'flex',flexWrap:'wrap' as const,gap:'6px',marginBottom:'8px'}}>
              {ALL_COLS.map(col=>{
                const on = visibleCols.includes(col.key)
                return (
                  <label key={col.key} style={{display:'flex',alignItems:'center',gap:'4px',padding:'4px 9px',borderRadius:'5px',cursor:'pointer',background:on?'#eff6ff':'#f8fafc',border:`1px solid ${on?'#bfdbfe':'#e2e8f0'}`,fontSize:'12px',color:on?'#2563eb':'#6b7280',userSelect:'none' as const}}>
                    <input type="checkbox" checked={on} onChange={e=>{
                      let next = e.target.checked ? [...visibleCols, col.key] : visibleCols.filter(k=>k!==col.key)
                      // maintain original order for new additions
                      next = ALL_COLS.map(c=>c.key).filter(k=>next.includes(k))
                      savePrefs(next)
                    }} style={{accentColor:'#2563eb',margin:0}}/>
                    {col.label}
                  </label>
                )
              })}
            </div>
            <div style={{display:'flex',gap:'7px'}}>
              <button onClick={()=>savePrefs(ALL_COLS.map(c=>c.key))} style={{padding:'4px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'11px',cursor:'pointer'}}>全选</button>
              <button onClick={()=>savePrefs(DEFAULT_COLS)} style={{padding:'4px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'11px',cursor:'pointer'}}>恢复默认</button>
            </div>
          </div>
        )}

        {/* Warning if no extra_data */}
        {hasNoExtraData && !loading && (
          <div style={{marginTop:'10px',padding:'8px 12px',borderRadius:'6px',background:'#fffbeb',border:'1px solid #fde68a',color:'#d97706',fontSize:'12px'}}>
            ⚠️ 当前数据缺少详情字段（物流渠道、跟踪号等），请前往「客户管理」点击「↻ 同步数据」重新同步以获取完整数据
          </div>
        )}
      </div>

      {/* Table */}
      <div style={{flex:1,overflow:'auto'}}>
        {loading ? (
          <div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8',fontSize:'14px'}}>加载中...</div>
        ) : filtered.length===0 ? (
          <div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8',fontSize:'14px'}}>
            {search?'未找到匹配数据':'暂无出库数据'}
          </div>
        ) : (
          <table style={{width:'100%',borderCollapse:'collapse' as const,background:'#fff'}}>
            <thead>
              <tr>
                {activeCols.map(col=>(
                  <th key={col.key}
                    style={{...th,minWidth:`${col.width}px`,background:dragOver===col.key?'#dbeafe':'#f8fafc'}}
                    draggable
                    onDragStart={()=>setDragCol(col.key)}
                    onDragOver={e=>{e.preventDefault();setDragOver(col.key)}}
                    onDrop={()=>onDrop(col.key)}
                    onDragEnd={()=>{setDragCol(null);setDragOver(null)}}>
                    <span style={{display:'flex',alignItems:'center',gap:'3px'}}>
                      <span style={{color:'#d1d5db',fontSize:'9px'}}>⣿</span>
                      {col.label}
                    </span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t,i)=>(
                <tr key={t.id} style={{background:i%2===0?'#fff':'#fafbfc'}}>
                  {activeCols.map(col=>(
                    <td key={col.key} style={{...td}} title={String(col.render(t))}>
                      {col.render(t)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  )
}
