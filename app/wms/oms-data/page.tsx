'use client'
import { useState } from 'react'
import Link from 'next/link'

const DATA_TYPES = [
  {key:'warehouses',  label:'仓库',     icon:'🏭', color:'#3b82f6', desc:'仓库基础信息'},
  {key:'inbound',     label:'入库单',   icon:'📦', color:'#22c55e', desc:'所有入库订单'},
  {key:'outbound',    label:'小包出库', icon:'🚚', color:'#f97316', desc:'一件代发出库单'},
  {key:'bigOutbound', label:'大货出库', icon:'🚛', color:'#f97316', desc:'FBA备货/送仓单'},
  {key:'returns',     label:'退件单',   icon:'↩️', color:'#ef4444', desc:'退货退件记录'},
  {key:'inventory',   label:'综合库存', icon:'📊', color:'#a855f7', desc:'实时库存数据'},
]

interface Summary {label:string;total:number;sample:any[];error?:string}

function TableView({items}: {items:any[]}) {
  if(!items||items.length===0) return <div style={{color:'#6b7280',fontSize:'12px',padding:'20px',textAlign:'center'}}>暂无数据</div>
  const keys = Object.keys(items[0]).slice(0,10)
  return (
    <div style={{overflowX:'auto'}}>
      <table style={{width:'100%',borderCollapse:'collapse',fontSize:'11px',minWidth:'600px'}}>
        <thead>
          <tr style={{background:'#f1f5f9'}}>
            {keys.map(k=><th key={k} style={{padding:'8px 12px',color:'#64748b',fontWeight:700,textAlign:'left',whiteSpace:'nowrap',borderBottom:'1px solid #e2e8f0'}}>{k}</th>)}
          </tr>
        </thead>
        <tbody>
          {items.slice(0,100).map((row,i)=>(
            <tr key={i} style={{borderBottom:'1px solid #f1f5f9',background:i%2===0?'transparent':'#f8fafc'}}>
              {keys.map(k=>(
                <td key={k} style={{padding:'7px 12px',color:'#64748b',maxWidth:'220px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}}>
                  {row[k]===null||row[k]===undefined ? <span style={{color:'#64748b'}}>—</span> : typeof row[k]==='object' ? <span style={{color:'#6b7280'}}>{JSON.stringify(row[k]).slice(0,60)}</span> : String(row[k])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {items.length>100&&<div style={{padding:'8px 12px',color:'#6b7280',fontSize:'11px',borderTop:'1px solid #1e2535'}}>显示前100条，共 {items.length} 条</div>}
    </div>
  )
}

export default function OmsDataPage() {
  const [summary,   setSummary]   = useState<Record<string,Summary>>({})
  const [scanning,  setScanning]  = useState(false)
  const [scanErr,   setScanErr]   = useState('')
  const [lastScan,  setLastScan]  = useState<string|null>(null)
  const [selected,  setSelected]  = useState<string|null>(null)
  const [detail,    setDetail]    = useState<{items:any[];total:number;error?:string}|null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const scan = async () => {
    setScanning(true); setScanErr('')
    try {
      const res  = await fetch('/api/lingxing/data?type=all')
      const text = await res.text()
      let data: any = {}
      try { data = JSON.parse(text) } catch { setScanErr(`服务器返回非JSON内容 (HTTP ${res.status}): ${text.slice(0,200)}`); setScanning(false); return }
      if(data.error) { setScanErr(data.error); setScanning(false); return }
      setSummary(data.summary ?? {})
      setLastScan(new Date().toLocaleString('zh-CN'))
    } catch(e:any) { setScanErr(e.message) }
    setScanning(false)
  }

  const loadDetail = async (type: string) => {
    setSelected(type); setLoadingDetail(true); setDetail(null)
    try {
      const res  = await fetch(`/api/lingxing/data?type=${type}`)
      const text = await res.text()
      let data: any = {}
      try { data = JSON.parse(text) } catch { setDetail({items:[],total:0,error:`服务器错误 (HTTP ${res.status}): ${text.slice(0,300)}`}); setLoadingDetail(false); return }
      setDetail({items: data.items ?? [], total: data.total ?? 0, error: data.error})
    } catch(e:any) { setDetail({items:[],total:0,error:e.message}) }
    setLoadingDetail(false)
  }

  const selMeta = DATA_TYPES.find(d=>d.key===selected)

  return (
    <div style={{flex:1,overflowY:'auto',background:'#f8fafc'}}>
      <div style={{maxWidth:'1200px',margin:'0 auto',padding:'28px 24px'}}>

        {/* Header */}
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'28px'}}>
          <div>
            <h1 style={{fontSize:'20px',fontWeight:800,color:'#0f172a'}}>领星 OMS 数据总览</h1>
            <p style={{fontSize:'12px',color:'#6b7280',marginTop:'4px'}}>
              {lastScan ? `上次扫描：${lastScan}` : '点击「扫描」获取各类数据条数'}
            </p>
          </div>
          <div style={{display:'flex',gap:'10px'}}>
            <Link href="/wms/sync" style={{padding:'8px 16px',borderRadius:'7px',border:'1px solid #e2e8f0',color:'#64748b',textDecoration:'none',fontSize:'12px'}}>⟳ 数据同步</Link>
            <button onClick={scan} disabled={scanning} style={{padding:'8px 20px',borderRadius:'7px',background:scanning?'#1e3a5f':'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:scanning?'not-allowed':'pointer',boxShadow:scanning?'none':'0 0 12px #3b82f644',transition:'all 0.2s'}}>
              {scanning ? '⟳ 扫描中...' : '⟳ 扫描所有数据'}
            </button>
          </div>
        </div>

        {scanErr && (
          <div style={{marginBottom:'16px',padding:'12px 16px',background:'#fef2f2',border:'1px solid #fecaca',borderRadius:'8px',color:'#ef4444',fontSize:'13px'}}>❌ {scanErr}</div>
        )}

        {/* Cards */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fill,minmax(180px,1fr))',gap:'12px',marginBottom:'24px'}}>
          {DATA_TYPES.map(dt=>{
            const s = summary[dt.key]
            const isSelected = selected===dt.key
            return (
              <div key={dt.key} onClick={()=>loadDetail(dt.key)}
                style={{background:isSelected?`${dt.color}18`:'#ffffff',border:`1px solid ${isSelected?dt.color+'55':'#e2e8f0'}`,borderRadius:'10px',padding:'16px',cursor:'pointer',transition:'all 0.15s'}}
                onMouseEnter={e=>{if(!isSelected)(e.currentTarget as HTMLDivElement).style.borderColor=dt.color+'44'}}
                onMouseLeave={e=>{if(!isSelected)(e.currentTarget as HTMLDivElement).style.borderColor='#e2e8f0'}}>
                <div style={{display:'flex',justifyContent:'space-between',alignItems:'flex-start',marginBottom:'10px'}}>
                  <span style={{fontSize:'22px'}}>{dt.icon}</span>
                  <span style={{fontSize:'24px',fontWeight:800,color:s?.error?'#ef4444':s?.total!==undefined?dt.color:'#0f172a',lineHeight:1}}>
                    {scanning&&!s ? '…' : s?.error ? '!' : s?.total!==undefined ? s.total : '—'}
                  </span>
                </div>
                <div style={{fontSize:'12px',fontWeight:700,color:'#0f172a'}}>{dt.label}</div>
                <div style={{fontSize:'10px',color:'#6b7280',marginTop:'2px'}}>{dt.desc}</div>
                {s?.error && <div style={{fontSize:'10px',color:'#ef4444',marginTop:'4px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap'}} title={s.error}>{s.error.slice(0,40)}</div>}
              </div>
            )
          })}
        </div>

        {/* Detail panel */}
        {selected && (
          <div style={{background:'#ffffff',border:`1px solid ${selMeta?.color??'#e2e8f0'}33`,borderRadius:'12px',overflow:'hidden'}}>
            <div style={{padding:'14px 20px',borderBottom:'1px solid #f1f5f9',display:'flex',alignItems:'center',gap:'10px'}}>
              <span style={{fontSize:'20px'}}>{selMeta?.icon}</span>
              <span style={{fontSize:'14px',fontWeight:700,color:'#0f172a'}}>{selMeta?.label}</span>
              {detail&&!detail.error&&<span style={{padding:'2px 10px',borderRadius:'8px',background:`${selMeta?.color}22`,color:selMeta?.color,fontSize:'11px',fontWeight:700}}>共 {detail.total} 条</span>}
              <div style={{marginLeft:'auto',display:'flex',gap:'8px'}}>
                <button onClick={()=>loadDetail(selected)} style={{padding:'5px 12px',borderRadius:'6px',background:'#eff6ff',border:'1px solid #bfdbfe',color:'#3b82f6',cursor:'pointer',fontSize:'11px'}}>↻ 刷新</button>
                <button onClick={()=>{setSelected(null);setDetail(null)}} style={{background:'none',border:'none',color:'#64748b',cursor:'pointer',fontSize:'18px',lineHeight:1,padding:'0 4px'}}>×</button>
              </div>
            </div>
            <div style={{padding:'0'}}>
              {loadingDetail ? (
                <div style={{padding:'40px',textAlign:'center',color:'#6b7280',fontSize:'13px'}}>⟳ 拉取数据中，请稍候...</div>
              ) : detail?.error ? (
                <div style={{padding:'20px',margin:'16px',background:'#ef444411',border:'1px solid #fecaca',borderRadius:'8px',color:'#ef4444',fontSize:'13px'}}>❌ {detail.error}</div>
              ) : detail ? (
                <TableView items={detail.items} />
              ) : null}
            </div>
          </div>
        )}

        {!lastScan && !scanning && (
          <div style={{textAlign:'center',padding:'40px',color:'#6b7280'}}>
            <div style={{fontSize:'36px',marginBottom:'12px',opacity:0.4}}>🔗</div>
            <div style={{fontSize:'14px',marginBottom:'8px'}}>点击「扫描所有数据」查看领星OMS中的数据概况</div>
            <div style={{fontSize:'12px',color:'#64748b'}}>或点击上方任意卡片直接查看该类数据</div>
          </div>
        )}
      </div>
    </div>
  )
}
