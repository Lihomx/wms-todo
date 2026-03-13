'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'

const DATA_TYPES: {key:string;label:string;icon:string;color:string;desc:string}[] = [
  {key:'warehouses',        label:'仓库',          icon:'🏭', color:'#3b82f6', desc:'仓库基础信息'},
  {key:'inbound',           label:'入库单',        icon:'📦', color:'#22c55e', desc:'所有入库订单'},
  {key:'outbound',          label:'小包出库',      icon:'🚚', color:'#f97316', desc:'一件代发出库单'},
  {key:'bigOutbound',       label:'大货出库',      icon:'🚛', color:'#f97316', desc:'FBA备货/送仓单'},
  {key:'returns',           label:'退件单',        icon:'↩️', color:'#ef4444', desc:'退货退件记录'},
  {key:'inventory',         label:'综合库存',      icon:'📊', color:'#a855f7', desc:'实时库存数据'},
  {key:'customers',         label:'客户列表',      icon:'👥', color:'#06b6d4', desc:'所有客户信息'},
  {key:'products',          label:'商品/SKU',      icon:'🏷️', color:'#eab308', desc:'商品SKU档案'},
  {key:'workOrders',        label:'工单',          icon:'📋', color:'#64748b', desc:'操作工单记录'},
  {key:'locations',         label:'库位',          icon:'📍', color:'#84cc16', desc:'库位基础信息'},
  {key:'locationInventory', label:'库位库存',      icon:'🗄️', color:'#06b6d4', desc:'各库位库存分布'},
  {key:'transferOrders',    label:'移库单',        icon:'🔄', color:'#8b5cf6', desc:'库内移库记录'},
  {key:'adjustOrders',      label:'调整单',        icon:'⚖️', color:'#ec4899', desc:'库存调整记录'},
  {key:'carriers',          label:'承运商',        icon:'🚀', color:'#94a3b8', desc:'物流承运商列表'},
]

interface Summary { label:string; total:number; error?:string; sample:any[] }

function JsonViewer({ data }: { data: any }) {
  const [collapsed, setCollapsed] = useState(true)
  if (!data) return null
  return (
    <div>
      <button onClick={()=>setCollapsed(c=>!c)} style={{background:'none',border:'none',color:'#3b82f6',cursor:'pointer',fontSize:'11px',padding:'2px 0'}}>
        {collapsed ? '▶ 展开查看' : '▼ 收起'}
      </button>
      {!collapsed && (
        <pre style={{background:'#060910',border:'1px solid #1e2535',borderRadius:'6px',padding:'12px',fontSize:'10px',color:'#94a3b8',overflow:'auto',maxHeight:'400px',marginTop:'6px',lineHeight:1.5}}>
          {JSON.stringify(data,null,2)}
        </pre>
      )}
    </div>
  )
}

function DetailTable({ items, type }: { items: any[]; type: string }) {
  if (!items || items.length === 0) return <div style={{color:'#475569',fontSize:'12px',padding:'12px'}}>暂无数据</div>
  const keys = Object.keys(items[0] ?? {}).slice(0, 12)
  return (
    <div style={{overflowX:'auto',marginTop:'12px'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px'}}>
        <thead>
          <tr style={{background:'#0d1117',borderBottom:'1px solid #2a3250'}}>
            {keys.map(k=><th key={k} style={{padding:'7px 10px',color:'#64748b',fontWeight:700,textAlign:'left',whiteSpace:'nowrap'}}>{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.slice(0,50).map((row,i)=>(
            <tr key={i} style={{borderBottom:'1px solid #1a2035',background:i%2===0?'transparent':'#0d1117'}}>
              {keys.map(k=>(
                <td key={k} style={{padding:'6px 10px',color:'#94a3b8',maxWidth:'200px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {typeof row[k]==='object'?JSON.stringify(row[k]):String(row[k]??'')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {items.length>50&&<div style={{padding:'8px 10px',color:'#475569',fontSize:'11px'}}>仅显示前50条，共 {items.length} 条</div>}
    </div>
  )
}

export default function OmsDataPage() {
  const [summary,  setSummary]  = useState<Record<string,Summary>>({})
  const [loading,  setLoading]  = useState(false)
  const [selected, setSelected] = useState<string|null>(null)
  const [detail,   setDetail]   = useState<{items:any[];total:number;error?:string}|null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [lastSync, setLastSync] = useState<string|null>(null)

  const loadSummary = async () => {
    setLoading(true)
    try {
      const res  = await fetch('/api/lingxing/data?type=all')
      const data = await res.json()
      if (data.summary) { setSummary(data.summary); setLastSync(data.timestamp) }
    } catch {}
    setLoading(false)
  }

  const loadDetail = async (type: string) => {
    setSelected(type)
    setDetailLoading(true)
    setDetail(null)
    try {
      const res  = await fetch(`/api/lingxing/data?type=${type}`)
      const data = await res.json()
      setDetail({ items: data.items ?? [], total: data.total ?? 0, error: data.error })
    } catch(e:any) { setDetail({ items:[], total:0, error:e.message }) }
    setDetailLoading(false)
  }

  useEffect(() => { loadSummary() }, [])

  const selectedMeta = DATA_TYPES.find(d=>d.key===selected)

  return (
    <div style={{flex:1,overflowY:'auto',background:'#0d1117'}}>
      <div style={{maxWidth:'1280px',margin:'0 auto',padding:'28px 24px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'28px'}}>
          <div>
            <h1 style={{fontSize:'20px',fontWeight:800,color:'#f1f5f9'}}>领星 OMS 数据总览</h1>
            <p style={{fontSize:'12px',color:'#475569',marginTop:'4px'}}>
              {lastSync ? `上次扫描：${new Date(lastSync).toLocaleString('zh-CN')}` : '点击「扫描所有数据」获取最新数据量'}
            </p>
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <Link href="/wms/dashboard" style={{padding:'8px 16px',borderRadius:'7px',border:'1px solid #2a3250',color:'#64748b',textDecoration:'none',fontSize:'12px'}}>← 首页</Link>
            <button onClick={loadSummary} disabled={loading} style={{padding:'8px 18px',borderRadius:'7px',background:'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:loading?'not-allowed':'pointer',opacity:loading?0.6:1}}>
              {loading ? '⟳ 扫描中...' : '⟳ 扫描所有数据'}
            </button>
          </div>
        </div>

        {/* Summary Grid */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(200px,1fr))',gap:'12px',marginBottom:'28px'}}>
          {DATA_TYPES.map(dt => {
            const s = summary[dt.key]
            const isSelected = selected === dt.key
            return (
              <div key={dt.key} onClick={()=>loadDetail(dt.key)} style={{background:isSelected?`${dt.color}15`:'#161b26',border:`1px solid ${isSelected?dt.color+'66':'#2a3250'}`,borderRadius:'10px',padding:'16px',cursor:'pointer',transition:'all 0.15s'}}
                onMouseEnter={e=>{if(!isSelected)e.currentTarget.style.borderColor=dt.color+'44'}}
                onMouseLeave={e=>{if(!isSelected)e.currentTarget.style.borderColor='#2a3250'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'8px'}}>
                  <div style={{fontSize:'20px'}}>{dt.icon}</div>
                  <div style={{fontSize:'22px',fontWeight:800,color:s?.error?'#ef4444':s?.total!==undefined?dt.color:'#2a3250',lineHeight:1}}>
                    {loading&&!s ? '…' : s?.error ? '!' : s?.total!==undefined ? s.total : '—'}
                  </div>
                </div>
                <div style={{fontSize:'12px',fontWeight:700,color:'#e2e8f0'}}>{dt.label}</div>
                <div style={{fontSize:'10px',color:'#475569',marginTop:'2px'}}>{dt.desc}</div>
                {s?.error && <div style={{fontSize:'10px',color:'#ef4444',marginTop:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>{s.error}</div>}
              </div>
            )
          })}
        </div>

        {/* Detail Panel */}
        {selected && (
          <div style={{background:'#161b26',border:`1px solid ${selectedMeta?.color??'#2a3250'}33`,borderRadius:'12px',overflow:'hidden'}}>
            <div style={{padding:'16px 20px',borderBottom:'1px solid #1e2535',display:'flex',alignItems:'center',justifyContent:'space-between'}}>
              <div style={{display:'flex',alignItems:'center',gap:'10px'}}>
                <span style={{fontSize:'20px'}}>{selectedMeta?.icon}</span>
                <div>
                  <div style={{fontSize:'14px',fontWeight:700,color:'#f1f5f9'}}>{selectedMeta?.label}</div>
                  <div style={{fontSize:'11px',color:'#475569'}}>{selectedMeta?.desc}</div>
                </div>
                {detail && !detail.error && (
                  <span style={{padding:'2px 10px',borderRadius:'10px',background:`${selectedMeta?.color}22`,color:selectedMeta?.color,fontSize:'11px',fontWeight:700}}>
                    共 {detail.total} 条
                  </span>
                )}
              </div>
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={()=>loadDetail(selected)} style={{padding:'6px 14px',borderRadius:'6px',background:'#1e3a5f',border:'1px solid #3b82f644',color:'#3b82f6',cursor:'pointer',fontSize:'11px'}}>↻ 刷新</button>
                <button onClick={()=>{setSelected(null);setDetail(null)}} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:'18px',lineHeight:1}}>×</button>
              </div>
            </div>
            <div style={{padding:'16px 20px'}}>
              {detailLoading ? (
                <div style={{padding:'40px',textAlign:'center',color:'#475569'}}>
                  <div style={{fontSize:'24px',marginBottom:'8px'}}>⟳</div>拉取中，请稍候...
                </div>
              ) : detail?.error ? (
                <div style={{padding:'20px',background:'#ef444411',border:'1px solid #ef444433',borderRadius:'8px',color:'#ef4444',fontSize:'13px'}}>
                  ❌ {detail.error}
                  <div style={{marginTop:'8px',fontSize:'11px',color:'#94a3b8'}}>该接口可能暂不支持或需要额外权限</div>
                </div>
              ) : detail ? (
                <>
                  <div style={{fontSize:'11px',color:'#475569',marginBottom:'4px'}}>以下为原始字段数据，最多显示50条：</div>
                  <DetailTable items={detail.items} type={selected} />
                  {detail.items.length > 0 && (
                    <div style={{marginTop:'12px'}}>
                      <div style={{fontSize:'11px',color:'#64748b',marginBottom:'6px',fontWeight:700}}>第一条原始数据（JSON）：</div>
                      <JsonViewer data={detail.items[0]} />
                    </div>
                  )}
                </>
              ) : null}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
