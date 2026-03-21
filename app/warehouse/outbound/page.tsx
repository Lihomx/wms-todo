'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'

// Status mapping: API status code -> Chinese name (from API doc)
// 0-新建(草稿) 2-仓库处理中 3-已出库 4-已取消 5-异常 7-获取面单异常
const API_STATUS: Record<number,{label:string;color:string}> = {
  0: {label:'待处理',   color:'#f97316'},
  2: {label:'处理中',   color:'#3b82f6'},
  3: {label:'已出库',   color:'#22c55e'},
  4: {label:'已取消',   color:'#64748b'},
  5: {label:'异常',     color:'#dc2626'},
  7: {label:'面单异常', color:'#dc2626'},
}

// Platform code -> name
const PLATFORM: Record<string,string> = {
  '1':'AliExpress','2':'Amazon','3':'Amazon VC','4':'eBay','5':'Lazada',
  '6':'Shopee','7':'Shopify','8':'Walmart','9':'Wayfair','10':'MercadoLibre',
  '11':'Wish','12':'Other','14':'Woocommerce','15':'HomeDepot','20':'Shoplazza',
  '21':'Jumia','22':'TikTok','23':'Xshoppy','24':'Shopline','27':'Etsy',
  '31':'Shoplus','33':'Shein','34':'Temu','35':'Yahoo',
}
const getPlatform = (code:any, name?:string) => name || PLATFORM[String(code??'')] || (code ? `平台${code}` : '-')

interface Todo {
  id:string; title:string; status:number; customer_code:string|null
  created_at:string; lingxing_order_no:string|null
  extra_data: Record<string,any>|null
}

const fmtDate = (d:any) => {
  if(!d) return '-'
  try { return new Date(d).toLocaleString('zh-CN',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}) }
  catch { return String(d) }
}

// Helper: get tracking number with multiple fallbacks
const getTrackNo = (e: Record<string,any>|null): string => {
  if(!e) return '-'
  // 1. expressList trackNos (most accurate - from detail API)
  const expList = e.expressList ?? []
  const expNos = expList.map((x:any)=>x.trackNo).filter(Boolean)
  if(expNos.length > 0) return expNos.join(' / ')
  // 2. logisticsTrackNos array
  if(Array.isArray(e.logisticsTrackNos) && e.logisticsTrackNos.length > 0) {
    const nos = e.logisticsTrackNos.filter(Boolean)
    if(nos.length > 0) return nos.join(' / ')
  }
  // 3. single logisticsTrackNo
  return e.logisticsTrackNo || '-'
}

type Col = {key:string;label:string;w:number;get:(t:Todo)=>any;excel?:string}

// Columns ordered to match Excel export structure
const COLS: Col[] = [
  {key:'outboundOrderNo',  label:'出库单号',      w:170, excel:'Outbound Order No', get:t=>t.lingxing_order_no??'-'},
  {key:'status',           label:'状态',          w:95,  excel:'Status', get:t=>{
    const e=t.extra_data; const apiStatus=e?.apiStatus
    const info = apiStatus!==undefined ? API_STATUS[apiStatus] : API_STATUS[t.status] ?? {label:'未知',color:'#94a3b8'}
    return <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:`${info.color}15`,color:info.color,border:`1px solid ${info.color}33`}}>{e?.statusName||info.label}</span>
  }},
  {key:'salesPlatform',    label:'销售平台',      w:130, excel:'Sale Platform', get:t=>getPlatform(t.extra_data?.salesPlatform, t.extra_data?.salesPlatformName)},
  {key:'storeName',        label:'店铺',          w:120, excel:'Store', get:t=>t.extra_data?.storeName||'-'},
  {key:'platformOrderNo',  label:'平台单号',      w:180, excel:'Platform Number', get:t=>t.extra_data?.platformOrderNo||'-'},
  {key:'referOrderNo',     label:'参考单号',      w:160, excel:'Reference order No.', get:t=>t.extra_data?.referOrderNo||'-'},
  {key:'subOrderTypeName', label:'订单品种类型',   w:120, excel:'Type of order variety', get:t=>t.extra_data?.subOrderTypeName||'-'},
  {key:'logisticsCarrier', label:'物流承运商',     w:150, excel:'Shipping Carrier', get:t=>t.extra_data?.logisticsCarrier||'-'},
  {key:'logisticsChannel', label:'物流渠道',      w:200, excel:'Shipping service', get:t=>t.extra_data?.logisticsChannel||'-'},
  {key:'logisticsTrackNo', label:'物流跟踪号',    w:180, excel:"Package 1 Tracking No.", get:t=>getTrackNo(t.extra_data)},
  {key:'receiver',         label:'收件人',        w:160, excel:'Recipient', get:t=>t.extra_data?.receiver||'-'},
  {key:'telephone',        label:'电话',          w:130, excel:'Telephone', get:t=>t.extra_data?.telephone||'-'},
  {key:'countryRegionCode',label:'国家',          w:60,  excel:'Country/Region', get:t=>t.extra_data?.countryRegionCode||'-'},
  {key:'provinceName',     label:'省/州',         w:110, excel:'Province/State', get:t=>{
    const p = t.extra_data?.provinceName||''
    // Clean up "MX-TAM(MX-TAM)" -> "MX-TAM"
    return p.replace(/\(.*\)$/, '').trim() || '-'
  }},
  {key:'cityName',         label:'城市',          w:100, excel:'City', get:t=>t.extra_data?.cityName||'-'},
  {key:'postCode',         label:'邮编',          w:80,  excel:'Post code', get:t=>t.extra_data?.postCode||'-'},
  {key:'addressOne',       label:'地址1',         w:220, excel:'Address1', get:t=>t.extra_data?.addressOne||'-'},
  {key:'addressTwo',       label:'地址2',         w:220, excel:'Address2', get:t=>t.extra_data?.addressTwo||'-'},
  {key:'customer_code',    label:'客户',          w:70,  get:t=>t.customer_code||'-'},
  {key:'whCode',           label:'仓库',          w:70,  get:t=>t.extra_data?.whCode||'-'},
  {key:'productQty',       label:'总数量',        w:75,  excel:'Total Qty of SKU', get:t=>{
    const list=t.extra_data?.productList??[]
    const qty=list.reduce((s:number,p:any)=>s+(Number(p.quantity)||0),0)
    return qty>0?qty:'-'
  }},
  {key:'productSku',       label:'SKU',           w:160, excel:'SKU 1 SKU', get:t=>{
    const list=t.extra_data?.productList??[]
    if(!list.length) return '-'
    return list.map((p:any)=>`${p.sku}×${p.quantity}`).join(' | ')
  }},
  {key:'productName',      label:'产品名称',      w:160, excel:'SKU 1 Product Name', get:t=>{
    const list=t.extra_data?.productList??[]
    return list.map((p:any)=>p.productName).filter(Boolean).join(', ')||'-'
  }},
  {key:'pkgWeight',        label:'包裹重量',      w:90,  excel:'Package 1 Weight', get:t=>{
    const list=t.extra_data?.expressList??[]
    if(!list.length) return '-'
    return list.map((e:any)=>e.weight?`${e.weight}kg`:null).filter(Boolean).join(' / ')||'-'
  }},
  {key:'pkgSize',          label:'包裹尺寸',      w:140, get:t=>{
    const list=t.extra_data?.expressList??[]
    if(!list.length) return '-'
    return list.map((e:any)=>e.length?`${e.length}×${e.width}×${e.height}cm`:null).filter(Boolean).join(' / ')||'-'
  }},
  {key:'costTotal',        label:'费用',          w:90,  get:t=>t.extra_data?.costTotal?`${t.extra_data.costTotal} ${t.extra_data.costCurrencyCode||''}`.trim():'-'},
  {key:'remark',           label:'备注',          w:120, excel:'Remark', get:t=>t.extra_data?.remark||'-'},
  {key:'orderCreateTime',  label:'创建时间',      w:155, excel:'Creation time', get:t=>fmtDate(t.extra_data?.orderCreateTime||t.created_at)},
  {key:'outboundTime',     label:'出库时间',      w:155, excel:'OutboundTime', get:t=>fmtDate(t.extra_data?.outboundTime)},
  {key:'canceledTime',     label:'取消时间',      w:155, get:t=>fmtDate(t.extra_data?.canceledTime)},
  {key:'exceptionDesc',    label:'异常原因',      w:150, get:t=>t.extra_data?.exceptionDesc||'-'},
]

const DEFAULT_COLS = ['outboundOrderNo','status','salesPlatform','logisticsCarrier','logisticsTrackNo','storeName','receiver','countryRegionCode','provinceName','cityName','productQty','productSku','platformOrderNo','orderCreateTime']

export default function OutboundDetailPage() {
  const [todos,          setTodos]          = useState<Todo[]>([])
  const [loading,        setLoading]        = useState(true)
  const [showPicker,     setShowPicker]     = useState(false)
  const [visibleCols,    setVisibleCols]    = useState<string[]>(DEFAULT_COLS)
  const [search,         setSearch]         = useState('')
  const [statusFilter,   setStatusFilter]   = useState('')
  const [platformFilter, setPlatformFilter] = useState('')
  const [dragCol,        setDragCol]        = useState<string|null>(null)
  const [dragOver,       setDragOver]       = useState<string|null>(null)

  useEffect(()=>{ try{const s=localStorage.getItem('wms-ob-cols2');if(s)setVisibleCols(JSON.parse(s))}catch{} },[])
  const savePrefs=useCallback((cols:string[])=>{ setVisibleCols(cols); try{localStorage.setItem('wms-ob-cols2',JSON.stringify(cols))}catch{} },[])

  useEffect(()=>{
    setLoading(true)
    const p=new URLSearchParams({pageSize:'500',category:'出库作业'})
    if(statusFilter) p.set('status',statusFilter)
    fetch(`/api/todos?${p}`).then(r=>r.json()).then(d=>{ setTodos(d.todos??[]); setLoading(false) })
  },[statusFilter])

  const onDrop=(toKey:string)=>{
    if(!dragCol||dragCol===toKey) return
    const o=[...visibleCols]; const f=o.indexOf(dragCol),t=o.indexOf(toKey)
    if(f===-1||t===-1) return
    o.splice(f,1); o.splice(t,0,dragCol); savePrefs(o); setDragCol(null); setDragOver(null)
  }

  const platforms=[...new Set(todos.map(t=>getPlatform(t.extra_data?.salesPlatform,t.extra_data?.salesPlatformName)).filter(p=>p&&p!=='-'))].sort()

  const filtered=todos.filter(t=>{
    if(platformFilter&&getPlatform(t.extra_data?.salesPlatform,t.extra_data?.salesPlatformName)!==platformFilter) return false
    if(!search) return true
    const s=search.toLowerCase(); const e=t.extra_data??{}
    return (t.lingxing_order_no||'').toLowerCase().includes(s)
      ||getTrackNo(e).toLowerCase().includes(s)
      ||(e.logisticsCarrier||'').toLowerCase().includes(s)
      ||(e.receiver||'').toLowerCase().includes(s)
      ||(e.platformOrderNo||'').toLowerCase().includes(s)
      ||(e.storeName||'').toLowerCase().includes(s)
      ||(e.productSku||'').toLowerCase().includes(s)
      ||getPlatform(e.salesPlatform,e.salesPlatformName).toLowerCase().includes(s)
  })

  const activeCols=visibleCols.map(k=>COLS.find(c=>c.key===k)).filter(Boolean) as Col[]
  const noData=todos.length>0&&todos.every(t=>!t.extra_data?.receiver)

  const th:React.CSSProperties={padding:'9px 12px',fontSize:'11px',fontWeight:700,color:'#475569',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap' as const,background:'#f8fafc',position:'sticky' as const,top:0,zIndex:2,cursor:'grab',userSelect:'none' as const}
  const td:React.CSSProperties={padding:'8px 12px',fontSize:'12px',color:'#0f172a',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap' as const,maxWidth:'240px',overflow:'hidden',textOverflow:'ellipsis'}
  const sel:React.CSSProperties={padding:'6px 10px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',fontSize:'12px',color:'#0f172a',cursor:'pointer',outline:'none'}

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden',background:'#f8fafc'}}>
      <div style={{padding:'12px 20px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'8px',marginBottom:showPicker?'10px':'0',flexWrap:'wrap' as const}}>
          <Link href="/warehouse/dashboard" style={{color:'#94a3b8',textDecoration:'none',fontSize:'13px',flexShrink:0}}>← 返回</Link>
          <span style={{color:'#e2e8f0'}}>/</span>
          <h1 style={{fontSize:'15px',fontWeight:700,color:'#0f172a',flexShrink:0}}>一件代发 · 出库明细</h1>
          <span style={{padding:'1px 8px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'11px',fontWeight:600,border:'1px solid #bfdbfe',flexShrink:0}}>{loading?'…':filtered.length} 条</span>
          <div style={{flex:1}}/>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="搜索单号/跟踪号/收件人/店铺..."
            style={{...sel,width:'230px'}}/>
          <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={sel}>
            <option value="">全部状态</option>
            {Object.entries(API_STATUS).map(([k,v])=><option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={platformFilter} onChange={e=>setPlatformFilter(e.target.value)} style={sel}>
            <option value="">全部平台</option>
            {platforms.map(p=><option key={p} value={p}>{p}</option>)}
          </select>
          <button onClick={()=>setShowPicker(s=>!s)} style={{...sel,background:showPicker?'#eff6ff':'#fff',color:showPicker?'#2563eb':'#475569',fontWeight:500,flexShrink:0}}>
            ⚙ 列设置 ({visibleCols.length})
          </button>
        </div>

        {showPicker&&(
          <div style={{paddingTop:'10px',borderTop:'1px solid #f1f5f9'}}>
            <div style={{fontSize:'11px',color:'#64748b',marginBottom:'7px'}}>勾选显示列（对应领星Excel导出列） · 拖动表头调整顺序</div>
            <div style={{display:'flex',flexWrap:'wrap' as const,gap:'5px',marginBottom:'7px'}}>
              {COLS.map(col=>{
                const on=visibleCols.includes(col.key)
                return <label key={col.key} style={{display:'flex',alignItems:'center',gap:'3px',padding:'3px 8px',borderRadius:'4px',cursor:'pointer',background:on?'#eff6ff':'#f8fafc',border:`1px solid ${on?'#bfdbfe':'#e2e8f0'}`,fontSize:'11px',color:on?'#2563eb':'#6b7280',userSelect:'none' as const}}>
                  <input type="checkbox" checked={on} onChange={e=>{
                    let next=e.target.checked?[...visibleCols,col.key]:visibleCols.filter(k=>k!==col.key)
                    next=COLS.map(c=>c.key).filter(k=>next.includes(k)); savePrefs(next)
                  }} style={{accentColor:'#2563eb',margin:0}}/>{col.label}
                  {col.excel&&<span style={{fontSize:'9px',color:'#94a3b8',marginLeft:'2px'}}>Excel</span>}
                </label>
              })}
            </div>
            <div style={{display:'flex',gap:'6px'}}>
              <button onClick={()=>savePrefs(COLS.map(c=>c.key))} style={{...sel,fontSize:'11px',padding:'4px 9px'}}>全选</button>
              <button onClick={()=>savePrefs(DEFAULT_COLS)} style={{...sel,fontSize:'11px',padding:'4px 9px'}}>恢复默认</button>
            </div>
          </div>
        )}

        {noData&&!loading&&(
          <div style={{marginTop:'8px',padding:'7px 12px',borderRadius:'6px',background:'#fffbeb',border:'1px solid #fde68a',color:'#d97706',fontSize:'12px'}}>
            ⚠️ 数据缺少详情，请前往「数据同步」→「🚚 一件代发」重新同步
          </div>
        )}
      </div>

      <div style={{flex:1,overflow:'auto'}}>
        {loading?<div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8',fontSize:'14px'}}>加载中...</div>
        :filtered.length===0?<div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8',fontSize:'14px'}}>{search?'未找到匹配':'暂无数据'}</div>
        :(
          <table style={{width:'100%',borderCollapse:'collapse' as const,background:'#fff'}}>
            <thead>
              <tr>
                {activeCols.map(col=>(
                  <th key={col.key} style={{...th,minWidth:`${col.w}px`,background:dragOver===col.key?'#dbeafe':'#f8fafc'}}
                    draggable onDragStart={()=>setDragCol(col.key)}
                    onDragOver={e=>{e.preventDefault();setDragOver(col.key)}}
                    onDrop={()=>onDrop(col.key)} onDragEnd={()=>{setDragCol(null);setDragOver(null)}}>
                    <span style={{display:'flex',alignItems:'center',gap:'3px'}}><span style={{color:'#d1d5db',fontSize:'9px'}}>⣿</span>{col.label}</span>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t,i)=>(
                <tr key={t.id} style={{background:i%2===0?'#fff':'#fafbfc'}}>
                  {activeCols.map(col=>(
                    <td key={col.key} style={td} title={typeof col.get(t)==='string'?col.get(t):undefined}>
                      {col.get(t)}
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
