'use client'
import { useState, useEffect } from 'react'

function getCC() {
  if(typeof window==='undefined') return ''
  try{const s=sessionStorage.getItem('wms_client_session');if(s){const p=JSON.parse(s);if(p.customerCode)return p.customerCode}}catch{}
  return ''
}

interface Product {
  sku:string; productName:string; productAliasName:string; approveStatus:number
  mainCode:string; length:number; width:number; height:number; weight:number
  wmsLength:number; wmsWidth:number; wmsHeight:number; wmsWeight:number
  declareNameCn:string; declarePrice:number; currencyCode:string
  dangerousCargo:number; countryOfOriginName:string
}

const STATUS_MAP: Record<number,{label:string;color:string;bg:string}> = {
  0:{label:'草稿',    color:'#64748b',bg:'#f1f5f9'},
  1:{label:'审核中',  color:'#d97706',bg:'#fffbeb'},
  2:{label:'已审核',  color:'#16a34a',bg:'#dcfce7'},
  3:{label:'已驳回',  color:'#dc2626',bg:'#fef2f2'},
  4:{label:'废弃',    color:'#94a3b8',bg:'#f8fafc'},
}
const DANGER_MAP: Record<number,string> = {
  1:'普货',2:'内置电池',3:'配套电池',4:'纯电池',5:'液体',6:'膏体',7:'粉末',8:'带磁'
}

export default function ClientProductsPage() {
  const [items,     setItems]     = useState<Product[]>([])
  const [loading,   setLoading]   = useState(true)
  const [error,     setError]     = useState('')
  const [search,    setSearch]    = useState('')
  const [statusTab, setStatusTab] = useState<number|'all'>('all')

  useEffect(()=>{
    const load = async(cc:string)=>{
      if(!cc) return
      const r = await fetch(`/api/oms-data?type=products&customerCode=${cc}`)
      const d = await r.json()
      if(d.error){setError(d.error);setLoading(false);return}
      setItems(d.items??[]); setLoading(false)
    }
    const cc=getCC()
    if(cc){load(cc);return}
    fetch('/api/auth-info').then(r=>r.json()).then(d=>load(d.customerCode||''))
  },[])

  const tabs = [
    {key:'all',label:'全部'},
    {key:0,label:'草稿'},
    {key:1,label:'审核中'},
    {key:2,label:'已审核'},
    {key:3,label:'已驳回'},
    {key:4,label:'废弃'},
  ]

  const filtered = items.filter(it=>{
    if(statusTab!=='all' && it.approveStatus!==statusTab) return false
    if(search && !(it.sku+it.productName+it.mainCode).toLowerCase().includes(search.toLowerCase())) return false
    return true
  })

  const th:React.CSSProperties={padding:'10px 14px',fontSize:'11px',fontWeight:700,color:'#475569',textAlign:'left' as const,borderBottom:'2px solid #e2e8f0',whiteSpace:'nowrap' as const,background:'#f8fafc',position:'sticky' as const,top:0}
  const td:React.CSSProperties={padding:'10px 14px',fontSize:'12px',color:'#0f172a',borderBottom:'1px solid #f1f5f9',whiteSpace:'nowrap' as const,verticalAlign:'middle' as const}

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden',background:'#f8fafc'}}>
      {/* Header */}
      <div style={{padding:'16px 24px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
          <div>
            <h1 style={{fontSize:'18px',fontWeight:700,color:'#0f172a'}}>产品管理</h1>
            <p style={{fontSize:'12px',color:'#64748b',marginTop:'2px'}}>共 {loading?'…':items.length} 个SKU</p>
          </div>
          <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="SKU / 产品名称搜索..."
            style={{padding:'7px 12px',borderRadius:'7px',border:'1px solid #e2e8f0',fontSize:'13px',outline:'none',width:'220px'}}/>
        </div>
        {/* Status tabs */}
        <div style={{display:'flex',gap:'0',borderBottom:'1px solid #e2e8f0'}}>
          {tabs.map(t=>{
            const count = t.key==='all' ? items.length : items.filter(i=>i.approveStatus===t.key).length
            const active = statusTab===t.key
            return (
              <button key={String(t.key)} onClick={()=>setStatusTab(t.key as any)}
                style={{padding:'8px 16px',border:'none',borderBottom:`2px solid ${active?'#2563eb':'transparent'}`,background:'none',color:active?'#2563eb':'#64748b',fontSize:'13px',fontWeight:active?600:400,cursor:'pointer'}}>
                {t.label}
                <span style={{marginLeft:'5px',padding:'1px 6px',borderRadius:'10px',fontSize:'10px',background:active?'#eff6ff':'#f1f5f9',color:active?'#2563eb':'#94a3b8'}}>{count}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Table */}
      <div style={{flex:1,overflow:'auto',padding:'16px 24px'}}>
        {loading ? <div style={{padding:'60px',textAlign:'center' as const,color:'#94a3b8'}}>加载中...</div>
        : error   ? <div style={{padding:'20px',color:'#dc2626',background:'#fef2f2',borderRadius:'8px',marginBottom:'14px'}}>{error}<br/><span style={{fontSize:'12px',color:'#94a3b8'}}>请在系统设置中确认AppKey已正确绑定</span></div>
        : (
          <div style={{background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',overflow:'hidden',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const}}>
              <thead>
                <tr>
                  <th style={th}>图片</th>
                  <th style={th}>SKU</th>
                  <th style={th}>产品名称</th>
                  <th style={th}>产品别名</th>
                  <th style={th}>WMS尺寸</th>
                  <th style={th}>WMS重量</th>
                  <th style={th}>OMS尺寸</th>
                  <th style={th}>OMS重量</th>
                  <th style={th}>申报中文名</th>
                  <th style={th}>申报价格</th>
                  <th style={th}>危险品</th>
                  <th style={th}>状态</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length===0
                  ? <tr><td colSpan={12} style={{...td,textAlign:'center' as const,color:'#94a3b8',padding:'40px'}}>暂无产品数据</td></tr>
                  : filtered.map((it,i)=>{
                    const st = STATUS_MAP[it.approveStatus] ?? {label:'未知',color:'#94a3b8',bg:'#f8fafc'}
                    return (
                      <tr key={it.sku} style={{background:i%2===0?'#fff':'#fafbfc'}}>
                        <td style={td}>
                          <div style={{width:'40px',height:'40px',borderRadius:'6px',background:'#f1f5f9',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'20px'}}>📦</div>
                        </td>
                        <td style={{...td,fontWeight:600,color:'#2563eb',fontFamily:'monospace'}}>{it.sku}</td>
                        <td style={{...td,maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis'}}>{it.productName||'-'}</td>
                        <td style={{...td,color:'#64748b',maxWidth:'120px',overflow:'hidden',textOverflow:'ellipsis'}}>{it.productAliasName||'-'}</td>
                        <td style={{...td,color:'#64748b',fontSize:'11px'}}>
                          {it.wmsLength&&it.wmsWidth&&it.wmsHeight ? `${it.wmsLength}×${it.wmsWidth}×${it.wmsHeight} cm` : '-'}
                        </td>
                        <td style={{...td,color:'#64748b',fontSize:'11px'}}>{it.wmsWeight ? `${it.wmsWeight} kg` : '-'}</td>
                        <td style={{...td,color:'#64748b',fontSize:'11px'}}>
                          {it.length&&it.width&&it.height ? `${it.length}×${it.width}×${it.height} cm` : '-'}
                        </td>
                        <td style={{...td,color:'#64748b',fontSize:'11px'}}>{it.weight ? `${it.weight} kg` : '-'}</td>
                        <td style={td}>{it.declareNameCn||'-'}</td>
                        <td style={td}>{it.declarePrice ? `${it.declarePrice} ${it.currencyCode||'USD'}` : '-'}</td>
                        <td style={td}><span style={{fontSize:'11px',color:'#64748b'}}>{DANGER_MAP[it.dangerousCargo]||'-'}</span></td>
                        <td style={td}><span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:st.bg,color:st.color}}>{st.label}</span></td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
