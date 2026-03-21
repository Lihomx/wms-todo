'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { parseScan, type ScanRule } from '@/lib/scan-parser'

interface ScanItem { id:string; sku:string; raw:string; rule:string; count:number; time:string }

const DEFAULT_RULE: ScanRule = {
  name: '默认规则', is_active: true, free_mode: false,
  extract_rules: [
    { type:'json_field', field:'id',           label:'JSON id字段' },
    { type:'json_field', field:'reference_id', label:'JSON reference_id字段' },
    { type:'regex', pattern:'([\\w/\\-]+)', group:1, label:'字母数字组合' },
  ],
  prefix_strip:'', suffix_strip:'', regex_replace:'', regex_with:'',
  sku_prefix_match:true, sku_exact_match:false,
}

export default function ScanPage() {
  const [items,      setItems]      = useState<ScanItem[]>([])
  const [rule,       setRule]       = useState<ScanRule>(DEFAULT_RULE)
  const [skus,       setSkus]       = useState<string[]>([])
  const [input,      setInput]      = useState('')
  const [lastResult, setLastResult] = useState<{ok:boolean;msg:string}|null>(null)
  const [sound,      setSound]      = useState(true)
  const [freeMode,   setFreeMode]   = useState(false)
  const [showDebug,  setShowDebug]  = useState(false)
  const [loading,    setLoading]    = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)

  // Load settings and SKUs
  useEffect(()=>{
    Promise.all([
      fetch('/api/scan-settings').then(r=>r.json()),
      fetch('/api/todos?pageSize=1&category=出库作业').then(r=>r.json()), // just to get customer
    ]).then(([sd]) => {
      const active = sd.settings?.find((s:ScanRule)=>s.is_active) || DEFAULT_RULE
      setRule(active)
      setFreeMode(active.free_mode)
      setLoading(false)
    })
    // Auto-focus input
    setTimeout(()=>inputRef.current?.focus(), 300)
  },[])

  // Load customer SKUs (for validation)
  const loadSkus = useCallback(async(customerCode:string)=>{
    const r = await fetch(`/api/client-skus?customerCode=${customerCode}&search=`)
    const d = await r.json()
    setSkus((d.skus||[]).map((s:any)=>s.sku))
  },[])

  useEffect(()=>{
    fetch('/api/oms-clients').then(r=>r.json()).then(d=>{
      const bound = (d.clients||[]).filter((c:any)=>c.auth_status===1)
      if(bound[0]) loadSkus(bound[0].customer_code)
    })
  },[loadSkus])

  // Process scan
  const processScan = useCallback((raw:string) => {
    if(!raw.trim()) return
    const effectiveRule = { ...rule, free_mode: freeMode }
    const result = parseScan(raw, effectiveRule, skus)

    if(!result.matched) {
      setLastResult({ok:false, msg:`❌ ${result.error || '未匹配SKU: ' + result.extracted}`})
      if(sound) playBeep(false)
      return
    }

    // Add or increment
    setItems(prev => {
      const existing = prev.find(i=>i.sku===result.matchedSku)
      if(existing) {
        return prev.map(i=>i.sku===result.matchedSku ? {...i, count:i.count+1, time:new Date().toLocaleTimeString('zh-CN')} : i)
      }
      return [{
        id:    Date.now().toString(),
        sku:   result.matchedSku!,
        raw:   result.raw,
        rule:  result.rule||'',
        count: 1,
        time:  new Date().toLocaleTimeString('zh-CN'),
      }, ...prev]
    })
    setLastResult({ok:true, msg:`✓ ${result.matchedSku} ${result.rule?`(${result.rule})`:''}`})
    if(sound) playBeep(true)
    setInput('')
  },[rule, freeMode, skus, sound])

  // Handle enter key
  const onKeyDown = (e:React.KeyboardEvent) => {
    if(e.key==='Enter') { processScan(input); e.preventDefault() }
  }

  // Auto-process when scanner adds newline
  useEffect(()=>{
    if(input.endsWith('\n')) processScan(input.trim())
  },[input, processScan])

  const playBeep = (success:boolean) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)()
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = success ? 880 : 220
      gain.gain.setValueAtTime(0.3, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.2)
      osc.start(); osc.stop(ctx.currentTime + 0.2)
    } catch {}
  }

  const remove = (id:string) => setItems(prev=>prev.filter(i=>i.id!==id))
  const clear  = () => { if(confirm('清空所有扫描记录？')) setItems([]) }

  const total = items.reduce((s,i)=>s+i.count, 0)
  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,display:'flex',flexDirection:'column' as const,overflow:'hidden',background:'#f8fafc'}}>
      {/* Header */}
      <div style={{padding:'14px 20px',background:'#fff',borderBottom:'1px solid #e2e8f0',flexShrink:0}}>
        <div style={{display:'flex',alignItems:'center',gap:'12px',flexWrap:'wrap' as const}}>
          <h1 style={{fontSize:'17px',fontWeight:700,color:'#0f172a'}}>📷 扫描分拣</h1>
          <span style={{padding:'2px 8px',borderRadius:'20px',background:'#eff6ff',color:'#2563eb',fontSize:'11px',fontWeight:600,border:'1px solid #bfdbfe'}}>{total} 件</span>
          <div style={{flex:1}}/>

          {/* Free mode toggle */}
          <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'13px',color:'#374151'}}>
            <div onClick={()=>setFreeMode(s=>!s)} style={{width:'36px',height:'20px',borderRadius:'10px',background:freeMode?'#2563eb':'#d1d5db',position:'relative',cursor:'pointer',transition:'background 0.2s'}}>
              <div style={{width:'16px',height:'16px',borderRadius:'50%',background:'#fff',position:'absolute',top:'2px',left:freeMode?'18px':'2px',transition:'left 0.2s',boxShadow:'0 1px 3px rgba(0,0,0,0.2)'}}/>
            </div>
            自由扫描{freeMode&&<span style={{color:'#f97316',fontSize:'11px',fontWeight:600}}> (任意内容)</span>}
          </label>

          {/* Sound toggle */}
          <button onClick={()=>setSound(s=>!s)} style={{padding:'5px 10px',borderRadius:'6px',border:'1px solid #e2e8f0',background:sound?'#f0fdf4':'#f8fafc',color:sound?'#16a34a':'#94a3b8',fontSize:'12px',cursor:'pointer'}}>
            {sound?'🔔 声音':'🔕 静音'}
          </button>

          <a href="/warehouse/scan/settings" style={{padding:'5px 10px',borderRadius:'6px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',fontSize:'12px',textDecoration:'none'}}>
            ⚙ 扫描设置
          </a>
        </div>

        {/* Scan input */}
        <div style={{marginTop:'12px',display:'flex',gap:'8px',alignItems:'center'}}>
          <div style={{position:'relative',flex:1}}>
            <span style={{position:'absolute',left:'12px',top:'50%',transform:'translateY(-50%)',fontSize:'16px',color:'#94a3b8'}}>📷</span>
            <input
              ref={inputRef}
              value={input}
              onChange={e=>setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="扫描条码/二维码，或手动输入后按回车..."
              autoFocus
              style={{width:'100%',padding:'11px 14px 11px 40px',borderRadius:'8px',border:'2px solid #2563eb',background:'#fff',fontSize:'14px',outline:'none',boxSizing:'border-box' as const}}
            />
          </div>
          <button onClick={()=>processScan(input)} style={{padding:'11px 18px',borderRadius:'8px',background:'#2563eb',border:'none',color:'white',fontWeight:600,fontSize:'14px',cursor:'pointer',flexShrink:0}}>
            确认
          </button>
        </div>

        {/* Last result */}
        {lastResult&&(
          <div style={{marginTop:'8px',padding:'8px 12px',borderRadius:'6px',background:lastResult.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${lastResult.ok?'#bbf7d0':'#fecaca'}`,color:lastResult.ok?'#166534':'#dc2626',fontSize:'13px',fontWeight:500}}>
            {lastResult.msg}
          </div>
        )}

        {/* Debug toggle */}
        {input&&<button onClick={()=>setShowDebug(s=>!s)} style={{marginTop:'6px',fontSize:'11px',color:'#94a3b8',background:'none',border:'none',cursor:'pointer'}}>
          {showDebug?'▲ 隐藏':'▼ 显示'}解析预览
        </button>}
        {showDebug&&input&&(()=>{
          const r = parseScan(input, {...rule,free_mode:freeMode}, skus)
          return <div style={{marginTop:'4px',padding:'8px 12px',borderRadius:'6px',background:'#f8fafc',border:'1px solid #e2e8f0',fontSize:'12px',fontFamily:'monospace'}}>
            <div>原始: <span style={{color:'#6b7280'}}>{r.raw.slice(0,80)}</span></div>
            <div>提取: <span style={{color:'#2563eb',fontWeight:600}}>{r.extracted}</span> <span style={{color:'#94a3b8'}}>({r.rule})</span></div>
            <div>匹配: <span style={{color:r.matched?'#16a34a':'#dc2626',fontWeight:600}}>{r.matched?`✓ ${r.matchedSku}`:`✗ ${r.error}`}</span></div>
          </div>
        })()}
      </div>

      {/* Results table */}
      <div style={{flex:1,overflowY:'auto' as const,padding:'16px 20px'}}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'12px'}}>
          <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>扫描记录</span>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={clear} style={{padding:'5px 12px',borderRadius:'6px',border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',fontSize:'12px',cursor:'pointer'}}>清空</button>
          </div>
        </div>

        {items.length===0?(
          <div style={{...card,padding:'60px',textAlign:'center' as const,color:'#94a3b8'}}>
            <div style={{fontSize:'36px',marginBottom:'10px',opacity:0.3}}>📷</div>
            <div style={{fontSize:'14px'}}>扫描条码或二维码开始分拣</div>
            <div style={{fontSize:'12px',marginTop:'6px'}}>支持USB扫码枪、摄像头扫描、手动输入</div>
          </div>
        ):(
          <div style={{...card,overflow:'hidden'}}>
            <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
              <thead><tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
                {['SKU','数量','扫描原始值','匹配规则','时间','操作'].map(h=>(
                  <th key={h} style={{padding:'10px 14px',color:'#64748b',fontWeight:600,textAlign:'left' as const,fontSize:'11px'}}>{h}</th>
                ))}
              </tr></thead>
              <tbody>
                {items.map((item,i)=>(
                  <tr key={item.id} style={{borderBottom:i<items.length-1?'1px solid #f8fafc':'none'}}>
                    <td style={{padding:'11px 14px',fontWeight:700,color:'#0f172a',fontFamily:'monospace'}}>{item.sku}</td>
                    <td style={{padding:'11px 14px'}}>
                      <div style={{display:'flex',alignItems:'center',gap:'6px'}}>
                        <button onClick={()=>setItems(p=>p.map(x=>x.id===item.id?{...x,count:Math.max(1,x.count-1)}:x))} style={{width:'22px',height:'22px',borderRadius:'4px',border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:'12px',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}>−</button>
                        <span style={{fontSize:'16px',fontWeight:800,color:'#2563eb',minWidth:'24px',textAlign:'center' as const}}>{item.count}</span>
                        <button onClick={()=>setItems(p=>p.map(x=>x.id===item.id?{...x,count:x.count+1}:x))} style={{width:'22px',height:'22px',borderRadius:'4px',border:'1px solid #e2e8f0',background:'#f8fafc',cursor:'pointer',fontSize:'12px',lineHeight:1,display:'flex',alignItems:'center',justifyContent:'center'}}>＋</button>
                      </div>
                    </td>
                    <td style={{padding:'11px 14px',color:'#94a3b8',fontSize:'11px',fontFamily:'monospace',maxWidth:'180px',overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const}} title={item.raw}>{item.raw.slice(0,40)}{item.raw.length>40?'…':''}</td>
                    <td style={{padding:'11px 14px'}}><span style={{padding:'2px 7px',borderRadius:'4px',background:'#eff6ff',color:'#2563eb',fontSize:'10px'}}>{item.rule}</span></td>
                    <td style={{padding:'11px 14px',color:'#94a3b8',fontSize:'12px'}}>{item.time}</td>
                    <td style={{padding:'11px 14px'}}><button onClick={()=>remove(item.id)} style={{padding:'3px 8px',borderRadius:'4px',border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:'11px'}}>删除</button></td>
                  </tr>
                ))}
              </tbody>
              <tfoot><tr style={{background:'#f8fafc',borderTop:'2px solid #e2e8f0'}}>
                <td style={{padding:'10px 14px',fontWeight:700,color:'#0f172a',fontSize:'13px'}}>合计</td>
                <td style={{padding:'10px 14px',fontWeight:800,color:'#2563eb',fontSize:'16px'}}>{total}</td>
                <td colSpan={4}/>
              </tr></tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
