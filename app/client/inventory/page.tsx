'use client'
import { useState, useEffect } from 'react'

function getCC() {
  if(typeof window==='undefined') return ''
  try{const s=sessionStorage.getItem('wms_client_session');if(s){const p=JSON.parse(s);if(p.customerCode)return p.customerCode}}catch{}
  return ''
}

interface InvItem {
  sku:string; productName:string; whCode:string; stockType:string
  totalAmount:number; productStockDtl?:{availableAmount:number;lockAmount:number;transportAmount:number}
  boxStockDtl?:{availableAmount:number;lockAmount:number}
  fbaReturnStockDtl?:{availableAmount:number;lockAmount:number}
}

export default function ClientInventoryPage() {
  const [items,   setItems]   = useState<InvItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error,   setError]   = useState('')
  const [search,  setSearch]  = useState('')
  const [tab,     setTab]     = useState<'product'|'box'|'return'>('product')
  const [hideZero,setHideZero]= useState(true)

  useEffect(()=>{
    const load = async (cc:string) => {
      if(!cc) return
      const r = await fetch(`/api/oms-data?type=inventory&customerCode=${cc}`)
      const d = await r.json()
      if(d.error) { setError(d.error); setLoading(false); return }
      setItems(d.items??[]); setLoading(false)
    }
    const cc = getCC()
    if(cc) { load(cc); return }
    fetch('/api/auth-info').then(r=>r.json()).then(d=>load(d.customerCode||''))
  },[])

  const filtered = items.filter(it=>{
    if(search && !(it.sku+it.productName).toLowerCase().includes(search.toLowerCase())) return false
    if(hideZero && it.totalAmount===0) return false
    return true
  })

  const th:React.CSSProperties={padding:'10px 14px',fontSize:'11px',fontWeight:700,color:'#475569',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap' as const,background:'#f8fafc',position:'sticky' as const,top:0}
  const td:React.CSSProperties={padding:'10px 14px',fontSize:'13px',color:'#0f172a',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap' as const}
  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  const tabs = [
    {key:'product',label:'产品库存',desc:'一件代发使用'},
    {key:'box',    label:'箱库存',  desc:'备货中转使用'},
    {key:'return', label:'退货库存',desc:'FBA退货换标'},
  ]

  // Stats
  const totalSkus = filtered.length
  const totalQty  = filtered.reduce((s,i)=>s+(i.productStockDtl?.availableAmount??0),0)
  const lockQty   = filtered.reduce((s,i)=>s+(i.productStockDtl?.lockAmount??0),0)

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden',background:'#f8fafc'}}>
      {/* Header */}
      <div style={{padding:'16px 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
          <div>
            <h1 style={{fontSize:'18px',fontWeight:700,color:'#0f172a'}}>产品库存</h1>
            <p style={{fontSize:'12px',color:'#64748b',marginTop:'2px'}}>按产品查询 · LIHO仓库</p>
          </div>
          <div style={{display:'flex',gap:'8px',alignItems:'center'}}>
            <label style={{display:'flex',alignItems:'center',gap:'5px',fontSize:'12px',color:'#64748b',cursor:'pointer'}}>
              <input type="checkbox" checked={hideZero} onChange={e=>setHideZero(e.target.checked)} style={{accentColor:'#2563eb'}}/>
              隐藏0库存
            </label>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="SKU精确搜索..."
              style={{padding:'7px 12px',borderRadius:'7px',border:'1px solid #e2e8f0',fontSize:'13px',outline:'none',width:'200px'}}/>
          </div>
        </div>
        {/* Stats */}
        <div style={{display:'flex',gap:'16px'}}>
          {[
            {l:'SKU种数',v:totalSkus,c:'#2563eb'},
            {l:'可用库存',v:totalQty, c:'#16a34a'},
            {l:'锁定库存',v:lockQty,  c:'#f97316'},
          ].map(s=>(
            <div key={s.l} style={{padding:'8px 14px',borderRadius:'8px',background:`${s.c}10`,border:`1px solid ${s.c}20`}}>
              <div style={{fontSize:'20px',fontWeight:800,color:s.c}}>{loading?'…':s.v}</div>
              <div style={{fontSize:'11px',color:'#64748b'}}>{s.l}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Tabs */}
      <div style={{padding:'0 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',display:'flex',gap:'0',flexShrink:0}}>
        {tabs.map(t=>(
          <button key={t.key} onClick={()=>setTab(t.key as any)}
            style={{padding:'10px 18px',border:'none',borderBottom:`2px solid ${tab===t.key?'#2563eb':'transparent'}`,background:'none',color:tab===t.key?'#2563eb':'#64748b',fontSize:'13px',fontWeight:tab===t.key?600:400,cursor:'pointer',display:'flex',alignItems:'center',gap:'6px'}}>
            {t.label}<span style={{fontSize:'10px',color:'#94a3b8'}}>{t.desc}</span>
          </button>
        ))}
      </div>

      {/* Table */}
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {loading ? <div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8'}}>加载中...</div>
        : error   ? <div style={{padding:'20px',color:'#dc2626',background:'#fef2f2',borderRadius:'8px'}}>{error}</div>
        : (
          <div style={card}>
            <table style={{width:'100%',borderCollapse:'collapse' as const}}>
              <thead>
                <tr>
                  <th style={th}>图片</th>
                  <th style={th}>SKU</th>
                  <th style={th}>产品名称</th>
                  <th style={th}>库存属性</th>
                  <th style={th}>仓库</th>
                  {tab==='product'&&<><th style={{...th,color:'#16a34a'}}>总库存</th><th style={{...th,color:'#16a34a'}}>可用库存</th><th style={{...th,color:'#f97316'}}>锁定库存</th><th style={{...th,color:'#94a3b8'}}>在途库存</th></>}
                  {tab==='box'    &&<><th style={{...th,color:'#16a34a'}}>箱库存总数</th><th style={{...th,color:'#16a34a'}}>可用</th><th style={{...th,color:'#f97316'}}>锁定</th></>}
                  {tab==='return' &&<><th style={{...th,color:'#16a34a'}}>退货库存</th><th style={{...th,color:'#16a34a'}}>可用</th><th style={{...th,color:'#f97316'}}>锁定</th></>}
                </tr>
              </thead>
              <tbody>
                {filtered.length===0
                  ? <tr><td colSpan={9} style={{...td,textAlign:'center' as const,color:'#94a3b8',padding:'40px'}}>暂无库存数据</td></tr>
                  : filtered.map((it,i)=>(
                  <tr key={`${it.sku}-${it.whCode}`} style={{background:i%2===0?'#fff':'#fafbfc'}}>
                    <td style={td}>
                      <div style={{width:'36px',height:'36px',borderRadius:'6px',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'18px'}}>📦</div>
                    </td>
                    <td style={{...td,fontWeight:600,color:'#2563eb',fontFamily:'monospace'}}>{it.sku}</td>
                    <td style={{...td,maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis'}}>{it.productName||'-'}</td>
                    <td style={td}><span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:it.stockType==='0'||it.stockType==='正品'?'#dcfce7':'#fef2f2',color:it.stockType==='0'||it.stockType==='正品'?'#16a34a':'#dc2626'}}>{it.stockType==='0'?'正品':it.stockType==='1'?'次品':it.stockType}</span></td>
                    <td style={{...td,color:'#64748b',fontSize:'12px'}}>{it.whCode}</td>
                    {tab==='product'&&<>
                      <td style={{...td,fontWeight:700,color:'#0f172a'}}>{it.totalAmount??0}</td>
                      <td style={{...td,color:'#16a34a',fontWeight:600}}>{it.productStockDtl?.availableAmount??0}</td>
                      <td style={{...td,color:it.productStockDtl?.lockAmount?'#f97316':'#94a3b8'}}>{it.productStockDtl?.lockAmount??0}</td>
                      <td style={{...td,color:'#94a3b8'}}>{it.productStockDtl?.transportAmount??0}</td>
                    </>}
                    {tab==='box'&&<>
                      <td style={{...td,fontWeight:700}}>{it.boxStockDtl?((it.boxStockDtl.availableAmount||0)+(it.boxStockDtl.lockAmount||0)):0}</td>
                      <td style={{...td,color:'#16a34a',fontWeight:600}}>{it.boxStockDtl?.availableAmount??0}</td>
                      <td style={{...td,color:'#f97316'}}>{it.boxStockDtl?.lockAmount??0}</td>
                    </>}
                    {tab==='return'&&<>
                      <td style={{...td,fontWeight:700}}>{it.fbaReturnStockDtl?((it.fbaReturnStockDtl.availableAmount||0)+(it.fbaReturnStockDtl.lockAmount||0)):0}</td>
                      <td style={{...td,color:'#16a34a',fontWeight:600}}>{it.fbaReturnStockDtl?.availableAmount??0}</td>
                      <td style={{...td,color:'#f97316'}}>{it.fbaReturnStockDtl?.lockAmount??0}</td>
                    </>}
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
