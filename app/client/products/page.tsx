'use client'
import { useState, useEffect } from 'react'

function getCC() {
  if(typeof window==='undefined') return ''
  try{const s=sessionStorage.getItem('wms_client_session');if(s){const p=JSON.parse(s);if(p.customerCode)return p.customerCode}}catch{}
  return ''
}

interface InvItem {
  sku:string; productName:string; whCode:string; stockType:string
  totalAmount:number
  productStockDtl?:{availableAmount:number;lockAmount:number;transportAmount:number}
  boxStockDtl?:{availableAmount:number;lockAmount:number}
  fbaReturnStockDtl?:{availableAmount:number;lockAmount:number}
}

export default function ClientProductsPage() {
  const [items,   setItems]   = useState<InvItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [tab,     setTab]     = useState<'all'|'product'|'box'|'return'>('all')
  const [hideZero,setHideZero]= useState(false)

  useEffect(()=>{
    const load = async(cc:string)=>{
      if(!cc) return
      const r = await fetch(`/api/oms-data?type=inventory&customerCode=${cc}`)
      const d = await r.json()
      if(d.error){ setError(d.error); setLoading(false); return }
      setItems(d.items??[]); setLoading(false)
    }
    const cc=getCC()
    if(cc){load(cc);return}
    fetch('/api/auth-info').then(r=>r.json()).then(d=>load(d.customerCode||''))
  },[])

  // Deduplicate by SKU (inventory may have same SKU in multiple warehouses)
  const skuMap = new Map<string, InvItem>()
  for(const it of items) {
    const existing = skuMap.get(it.sku)
    if(!existing) { skuMap.set(it.sku, it) }
    else {
      // Merge stock numbers
      skuMap.set(it.sku, {
        ...existing,
        totalAmount: (existing.totalAmount||0)+(it.totalAmount||0),
        productStockDtl: existing.productStockDtl ? {
          availableAmount: (existing.productStockDtl.availableAmount||0)+(it.productStockDtl?.availableAmount||0),
          lockAmount:      (existing.productStockDtl.lockAmount||0)+(it.productStockDtl?.lockAmount||0),
          transportAmount: (existing.productStockDtl.transportAmount||0)+(it.productStockDtl?.transportAmount||0),
        } : it.productStockDtl,
      })
    }
  }
  const allSkus = [...skuMap.values()]

  const filtered = allSkus.filter(it=>{
    if(hideZero && it.totalAmount===0) return false
    if(tab==='product' && !(it.productStockDtl?.availableAmount || it.productStockDtl?.lockAmount)) return false
    if(tab==='box'     && !(it.boxStockDtl?.availableAmount     || it.boxStockDtl?.lockAmount))     return false
    if(tab==='return'  && !(it.fbaReturnStockDtl?.availableAmount || it.fbaReturnStockDtl?.lockAmount)) return false
    if(search && !(it.sku+it.productName).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  // Count per tab
  const countProduct = allSkus.filter(i=>(i.productStockDtl?.availableAmount||0)+(i.productStockDtl?.lockAmount||0)>0).length
  const countBox     = allSkus.filter(i=>(i.boxStockDtl?.availableAmount||0)+(i.boxStockDtl?.lockAmount||0)>0).length
  const countReturn  = allSkus.filter(i=>(i.fbaReturnStockDtl?.availableAmount||0)+(i.fbaReturnStockDtl?.lockAmount||0)>0).length

  const th:React.CSSProperties={padding:'10px 14px',fontSize:'11px',fontWeight:700,color:'#475569',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap' as const,background:'#f8fafc',position:'sticky' as const,top:0,zIndex:1}
  const td:React.CSSProperties={padding:'10px 14px',fontSize:'12px',color:'#0f172a',borderBottom:'1px solid #f1f5f9',verticalAlign:'middle' as const}

  const tabs = [
    {key:'all',    label:'全部',    count:allSkus.length},
    {key:'product',label:'产品库存', count:countProduct, desc:'一件代发'},
    {key:'box',    label:'箱库存',   count:countBox,     desc:'备货中转'},
    {key:'return', label:'退货库存', count:countReturn,  desc:'FBA退货'},
  ]

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden',background:'#f8fafc'}}>
      {/* Header */}
      <div style={{padding:'14px 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
          <div>
            <h1 style={{fontSize:'18px',fontWeight:700,color:'#0f172a'}}>产品管理</h1>
            <p style={{fontSize:'12px',color:'#64748b',marginTop:'2px'}}>共 {loading?'…':allSkus.length} 个SKU · 来源：综合库存</p>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <label style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'12px',color:'#64748b',cursor:'pointer'}}>
              <input type="checkbox" checked={hideZero} onChange={e=>setHideZero(e.target.checked)} style={{accentColor:'#2563eb'}}/>隐藏零库存
            </label>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="SKU / 产品名称..."
              style={{padding:'7px 12px',borderRadius:'7px',border:'1px solid #e2e8f0',fontSize:'13px',outline:'none',width:'200px'}}/>
          </div>
        </div>
        {/* Tabs */}
        <div style={{display:'flex',gap:'0'}}>
          {tabs.map(t=>{
            const active = tab===t.key
            return (
              <button key={t.key} onClick={()=>setTab(t.key as any)}
                style={{padding:'8px 16px',border:'none',borderBottom:`2px solid ${active?'#2563eb':'transparent'}`,background:'none',color:active?'#2563eb':'#64748b',fontSize:'13px',fontWeight:active?600:400,cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
                {t.label}
                <span style={{padding:'1px 6px',borderRadius:'10px',fontSize:'10px',background:active?'#eff6ff':'#f1f5f9',color:active?'#2563eb':'#94a3b8',fontWeight:600}}>{t.count}</span>
                {(t as any).desc&&<span style={{fontSize:'10px',color:'#94a3b8'}}>({(t as any).desc})</span>}
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {loading ? <div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8',fontSize:'14px'}}>加载中...</div>
        : error ? (
          <div style={{padding:'16px',borderRadius:'8px',background:'#fef2f2',border:'1px solid #fecaca',color:'#dc2626',fontSize:'13px'}}>
            ⚠️ {error}
          </div>
        ) : (
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const}}>
              <thead>
                <tr>
                  <th style={th}>图片</th>
                  <th style={th}>SKU</th>
                  <th style={th}>产品名称</th>
                  <th style={th}>库存属性</th>
                  <th style={th}>仓库</th>
                  <th style={{...th,color:'#16a34a'}}>总库存</th>
                  <th style={{...th,color:'#16a34a'}}>产品可用</th>
                  <th style={{...th,color:'#f97316'}}>产品锁定</th>
                  <th style={{...th,color:'#94a3b8'}}>在途</th>
                  <th style={{...th,color:'#3b82f6'}}>箱可用</th>
                  <th style={{...th,color:'#7c3aed'}}>退货可用</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length===0
                  ? <tr><td colSpan={11} style={{...td,textAlign:'center' as const,color:'#94a3b8',padding:'40px'}}>
                      {search ? `未找到匹配"${search}"的产品` : '暂无库存数据'}
                    </td></tr>
                  : filtered.map((it,i)=>(
                  <tr key={it.sku} style={{background:i%2===0?'#fff':'#fafbfc'}}>
                    <td style={td}>
                      <div style={{width:'36px',height:'36px',borderRadius:'6px',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>📦</div>
                    </td>
                    <td style={{...td,fontWeight:700,color:'#2563eb',fontFamily:'monospace',fontSize:'12px'}}>{it.sku}</td>
                    <td style={{...td,maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}} title={it.productName}>{it.productName||'-'}</td>
                    <td style={td}>
                      <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,
                        background:it.stockType==='0'||it.stockType==='正品'?'#dcfce7':'#fef2f2',
                        color:it.stockType==='0'||it.stockType==='正品'?'#16a34a':'#dc2626'}}>
                        {it.stockType==='0'?'正品':it.stockType==='1'?'次品':it.stockType||'正品'}
                      </span>
                    </td>
                    <td style={{...td,fontSize:'11px',color:'#64748b'}}>{it.whCode}</td>
                    <td style={{...td,fontWeight:700}}>{it.totalAmount??0}</td>
                    <td style={{...td,color:'#16a34a',fontWeight:600}}>{it.productStockDtl?.availableAmount??0}</td>
                    <td style={{...td,color:(it.productStockDtl?.lockAmount||0)>0?'#f97316':'#94a3b8'}}>{it.productStockDtl?.lockAmount??0}</td>
                    <td style={{...td,color:'#94a3b8'}}>{it.productStockDtl?.transportAmount??0}</td>
                    <td style={{...td,color:'#3b82f6'}}>{it.boxStockDtl?.availableAmount??0}</td>
                    <td style={{...td,color:'#7c3aed'}}>{it.fbaReturnStockDtl?.availableAmount??0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
