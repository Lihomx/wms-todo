'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { parseScan, type ScanRule, type ExtractRule } from '@/lib/scan-parser'

const RULE_TYPES = [
  { v:'json_field', l:'JSON字段提取', hint:'从JSON格式的扫描结果中提取指定字段的值' },
  { v:'regex',      l:'正则表达式',   hint:'使用正则表达式从扫描结果中提取特定内容' },
  { v:'raw',        l:'原始值',       hint:'直接使用扫描结果，不做任何提取' },
]

const TEST_SAMPLES = [
  { label:'MercadoLibre QR', value:'{"id":"53618319/4","reference_id":"53618319/4","t":"inb","ops_data":{"source":"seller","container_type":"box"}}' },
  { label:'普通SKU条码', value:'N4-37' },
  { label:'带前缀SKU', value:'SKU-N4-37-RED' },
  { label:'数字条码', value:'1234567890128' },
]

const EMPTY_RULE: ScanRule = {
  name: '新扫描规则', is_active: true, free_mode: false,
  extract_rules: [{ type:'json_field', field:'id', label:'JSON id字段' }],
  prefix_strip:'', suffix_strip:'', regex_replace:'', regex_with:'',
  sku_prefix_match:true, sku_exact_match:false,
}

export default function ScanSettingsPage() {
  const [settings,  setSettings]  = useState<(ScanRule & {id:number})[]>([])
  const [editing,   setEditing]   = useState<ScanRule & {id?:number} | null>(null)
  const [testInput, setTestInput] = useState('')
  const [testResult,setTestResult]= useState<any>(null)
  const [saving,    setSaving]    = useState(false)
  const [msg,       setMsg]       = useState('')

  useEffect(()=>{
    fetch('/api/scan-settings').then(r=>r.json()).then(d=>setSettings(d.settings||[]))
  },[])

  const save = async()=>{
    if(!editing) return
    setSaving(true)
    const r = await fetch('/api/scan-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(editing)})
    const d = await r.json()
    if(d.error){ setMsg('❌ '+d.error) } else {
      setMsg('✅ 保存成功')
      fetch('/api/scan-settings').then(r=>r.json()).then(d=>setSettings(d.settings||[]))
      setEditing(null)
    }
    setSaving(false)
    setTimeout(()=>setMsg(''),2000)
  }

  const del = async(id:number)=>{
    if(!confirm('确认删除此规则？')) return
    await fetch(`/api/scan-settings?id=${id}`,{method:'DELETE'})
    setSettings(s=>s.filter(x=>x.id!==id))
  }

  const setActive = async(id:number)=>{
    // set this as active, deactivate others
    for(const s of settings) {
      await fetch('/api/scan-settings',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:s.id,is_active:s.id===id})})
    }
    setSettings(s=>s.map(x=>({...x,is_active:x.id===id})))
  }

  const runTest = ()=>{
    if(!editing||!testInput.trim()) return
    const result = parseScan(testInput, editing, ['N4-37','N4-40','N5-37','6ORW66R','SKU-001'])
    setTestResult(result)
  }

  const addExtractRule = ()=>{
    if(!editing) return
    setEditing({...editing, extract_rules:[...editing.extract_rules, {type:'json_field',field:'',label:'新规则'}]})
  }

  const updateExtractRule = (i:number, upd:Partial<ExtractRule>)=>{
    if(!editing) return
    const rules = editing.extract_rules.map((r,idx)=>idx===i?{...r,...upd}:r)
    setEditing({...editing, extract_rules:rules})
  }

  const removeExtractRule = (i:number)=>{
    if(!editing) return
    setEditing({...editing, extract_rules:editing.extract_rules.filter((_,idx)=>idx!==i)})
  }

  const inp:React.CSSProperties={width:'100%',padding:'8px 11px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#0f172a',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}
  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'24px 28px'}}>
      <div style={{display:'flex',alignItems:'center',gap:'12px',marginBottom:'20px'}}>
        <Link href="/warehouse/scan" style={{color:'#94a3b8',textDecoration:'none',fontSize:'13px'}}>← 返回扫描</Link>
        <span style={{color:'#e2e8f0'}}>/</span>
        <h1 style={{fontSize:'18px',fontWeight:700,color:'#0f172a'}}>⚙ 扫描设置</h1>
      </div>

      {msg&&<div style={{marginBottom:'12px',padding:'9px 14px',borderRadius:'7px',background:msg.startsWith('✅')?'#f0fdf4':'#fef2f2',border:`1px solid ${msg.startsWith('✅')?'#bbf7d0':'#fecaca'}`,color:msg.startsWith('✅')?'#16a34a':'#dc2626',fontSize:'13px'}}>{msg}</div>}

      <div style={{display:'grid',gridTemplateColumns:editing?'320px 1fr':'1fr',gap:'16px',alignItems:'start'}}>
        {/* Rules list */}
        <div>
          <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'10px'}}>
            <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>扫描规则</span>
            <button onClick={()=>setEditing({...EMPTY_RULE})} style={{padding:'5px 12px',borderRadius:'6px',background:'#2563eb',border:'none',color:'white',fontSize:'12px',cursor:'pointer',fontWeight:500}}>+ 新建</button>
          </div>
          <div style={{display:'flex',flexDirection:'column' as const,gap:'8px'}}>
            {settings.map(s=>(
              <div key={s.id} style={{...card,padding:'12px 14px',cursor:'pointer',borderLeft:`3px solid ${s.is_active?'#2563eb':'#e2e8f0'}`,background:editing?.id===s.id?'#f8fbff':'#fff'}} onClick={()=>setEditing({...s})}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'4px'}}>
                  <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>{s.name}</span>
                  <div style={{display:'flex',gap:'5px'}}>
                    {!s.is_active&&<button onClick={e=>{e.stopPropagation();setActive(s.id)}} style={{padding:'2px 7px',borderRadius:'4px',border:'1px solid #bfdbfe',background:'#eff6ff',color:'#2563eb',cursor:'pointer',fontSize:'10px'}}>设为启用</button>}
                    {s.is_active&&<span style={{padding:'2px 7px',borderRadius:'4px',background:'#dcfce7',color:'#16a34a',fontSize:'10px',fontWeight:600}}>✓ 当前</span>}
                    <button onClick={e=>{e.stopPropagation();del(s.id)}} style={{padding:'2px 7px',borderRadius:'4px',border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:'10px'}}>删除</button>
                  </div>
                </div>
                <div style={{fontSize:'11px',color:'#94a3b8'}}>
                  {s.free_mode&&<span style={{color:'#f97316',marginRight:'8px'}}>自由模式</span>}
                  {s.sku_prefix_match&&<span style={{marginRight:'8px'}}>前缀匹配</span>}
                  提取规则 {s.extract_rules?.length||0} 条
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Editor */}
        {editing&&(
          <div style={card}>
            <div style={{padding:'14px 18px',borderBottom:'1px solid #f1f5f9',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
              <span style={{fontSize:'14px',fontWeight:700,color:'#0f172a'}}>{editing.id?'编辑规则':'新建规则'}</span>
              <button onClick={()=>setEditing(null)} style={{background:'none',border:'none',cursor:'pointer',color:'#94a3b8',fontSize:'18px',lineHeight:1}}>×</button>
            </div>
            <div style={{padding:'16px 18px'}}>
              {/* Basic */}
              <div style={{marginBottom:'14px'}}>
                <label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>规则名称</label>
                <input value={editing.name} onChange={e=>setEditing({...editing,name:e.target.value})} style={inp}/>
              </div>

              {/* Toggles */}
              <div style={{display:'flex',gap:'16px',marginBottom:'16px',padding:'12px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
                <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'13px'}}>
                  <input type="checkbox" checked={editing.free_mode} onChange={e=>setEditing({...editing,free_mode:e.target.checked})} style={{accentColor:'#f97316'}}/>
                  <span>自由扫描模式</span>
                  <span style={{fontSize:'10px',color:'#94a3b8'}}>(不验证SKU)</span>
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'13px'}}>
                  <input type="checkbox" checked={editing.sku_prefix_match} onChange={e=>setEditing({...editing,sku_prefix_match:e.target.checked})} style={{accentColor:'#2563eb'}}/>
                  <span>SKU前缀匹配</span>
                  <span style={{fontSize:'10px',color:'#94a3b8'}}>(扫描值以SKU开头即匹配)</span>
                </label>
                <label style={{display:'flex',alignItems:'center',gap:'6px',cursor:'pointer',fontSize:'13px'}}>
                  <input type="checkbox" checked={editing.sku_exact_match} onChange={e=>setEditing({...editing,sku_exact_match:e.target.checked})} style={{accentColor:'#2563eb'}}/>
                  <span>精确匹配</span>
                </label>
              </div>

              {/* Extract rules */}
              <div style={{marginBottom:'14px'}}>
                <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'8px'}}>
                  <label style={{fontSize:'12px',fontWeight:600,color:'#0f172a'}}>📋 提取规则（按顺序尝试，第一个成功的规则生效）</label>
                  <button onClick={addExtractRule} style={{padding:'3px 9px',borderRadius:'5px',background:'#2563eb',border:'none',color:'white',fontSize:'11px',cursor:'pointer'}}>+ 添加</button>
                </div>
                {editing.extract_rules.map((r,i)=>(
                  <div key={i} style={{padding:'10px 12px',background:'#f8fafc',borderRadius:'7px',border:'1px solid #e2e8f0',marginBottom:'7px'}}>
                    <div style={{display:'flex',gap:'8px',alignItems:'flex-start',marginBottom:'6px'}}>
                      <span style={{fontSize:'11px',color:'#94a3b8',padding:'3px 7px',borderRadius:'3px',background:'#e2e8f0',flexShrink:0}}>{i+1}</span>
                      <select value={r.type} onChange={e=>updateExtractRule(i,{type:e.target.value as any})} style={{...inp,flex:1,fontSize:'12px',padding:'5px 8px'}}>
                        {RULE_TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
                      </select>
                      <button onClick={()=>removeExtractRule(i)} style={{padding:'3px 8px',borderRadius:'4px',border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:'11px',flexShrink:0}}>删</button>
                    </div>
                    <div style={{fontSize:'11px',color:'#94a3b8',marginBottom:'6px'}}>{RULE_TYPES.find(t=>t.v===r.type)?.hint}</div>
                    {r.type==='json_field'&&(
                      <input value={r.field||''} onChange={e=>updateExtractRule(i,{field:e.target.value})} placeholder="字段名，如: id" style={{...inp,fontSize:'12px',padding:'6px 10px'}}/>
                    )}
                    {r.type==='regex'&&(
                      <div style={{display:'grid',gridTemplateColumns:'1fr 60px',gap:'6px'}}>
                        <input value={r.pattern||''} onChange={e=>updateExtractRule(i,{pattern:e.target.value})} placeholder="正则表达式，如: ([\\w/]+)" style={{...inp,fontSize:'12px',padding:'6px 10px',fontFamily:'monospace'}}/>
                        <input type="number" value={r.group??1} onChange={e=>updateExtractRule(i,{group:Number(e.target.value)})} min={0} max={9} placeholder="组" style={{...inp,fontSize:'12px',padding:'6px 10px'}}/>
                      </div>
                    )}
                    <input value={r.label||''} onChange={e=>updateExtractRule(i,{label:e.target.value})} placeholder="规则说明标签" style={{...inp,fontSize:'11px',padding:'5px 9px',marginTop:'5px',color:'#94a3b8'}}/>
                  </div>
                ))}
              </div>

              {/* Post-extract transforms */}
              <div style={{padding:'12px',background:'#f8fafc',borderRadius:'8px',border:'1px solid #e2e8f0',marginBottom:'14px'}}>
                <div style={{fontSize:'12px',fontWeight:600,color:'#0f172a',marginBottom:'8px'}}>🔧 提取后处理（可选）</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'8px',marginBottom:'6px'}}>
                  <div><label style={{fontSize:'11px',color:'#64748b',display:'block',marginBottom:'3px'}}>去掉前缀</label><input value={editing.prefix_strip} onChange={e=>setEditing({...editing,prefix_strip:e.target.value})} placeholder="如: SKU-" style={{...inp,fontSize:'12px'}}/></div>
                  <div><label style={{fontSize:'11px',color:'#64748b',display:'block',marginBottom:'3px'}}>去掉后缀</label><input value={editing.suffix_strip} onChange={e=>setEditing({...editing,suffix_strip:e.target.value})} placeholder="如: -CN" style={{...inp,fontSize:'12px'}}/></div>
                  <div><label style={{fontSize:'11px',color:'#64748b',display:'block',marginBottom:'3px'}}>正则替换（查找）</label><input value={editing.regex_replace} onChange={e=>setEditing({...editing,regex_replace:e.target.value})} placeholder="如: \\s+" style={{...inp,fontSize:'12px',fontFamily:'monospace'}}/></div>
                  <div><label style={{fontSize:'11px',color:'#64748b',display:'block',marginBottom:'3px'}}>替换为</label><input value={editing.regex_with} onChange={e=>setEditing({...editing,regex_with:e.target.value})} placeholder="留空则删除" style={{...inp,fontSize:'12px'}}/></div>
                </div>
              </div>

              {/* Test area */}
              <div style={{padding:'12px',background:'#fffbeb',borderRadius:'8px',border:'1px solid #fde68a',marginBottom:'14px'}}>
                <div style={{fontSize:'12px',fontWeight:600,color:'#92400e',marginBottom:'8px'}}>🧪 测试当前规则</div>
                <div style={{display:'flex',gap:'8px',marginBottom:'6px',flexWrap:'wrap' as const}}>
                  {TEST_SAMPLES.map(s=>(
                    <button key={s.label} onClick={()=>{setTestInput(s.value);}} style={{padding:'3px 8px',borderRadius:'4px',border:'1px solid #fde68a',background:'#fff',color:'#92400e',fontSize:'11px',cursor:'pointer'}}>{s.label}</button>
                  ))}
                </div>
                <div style={{display:'flex',gap:'6px',marginBottom:'8px'}}>
                  <input value={testInput} onChange={e=>setTestInput(e.target.value)} placeholder="粘贴扫描内容测试..." style={{...inp,flex:1,fontFamily:'monospace',fontSize:'12px'}}/>
                  <button onClick={runTest} style={{padding:'7px 14px',borderRadius:'6px',background:'#d97706',border:'none',color:'white',fontSize:'12px',cursor:'pointer',fontWeight:600,flexShrink:0}}>测试</button>
                </div>
                {testResult&&(
                  <div style={{fontSize:'12px',fontFamily:'monospace',lineHeight:1.8}}>
                    <div>原始: <span style={{color:'#6b7280'}}>{testResult.raw?.slice(0,60)}</span></div>
                    <div>提取: <span style={{color:'#2563eb',fontWeight:600}}>{testResult.extracted}</span></div>
                    <div>规则: <span style={{color:'#64748b'}}>{testResult.rule}</span></div>
                    <div>结果: <span style={{color:testResult.matched?'#16a34a':'#dc2626',fontWeight:700}}>{testResult.matched?`✓ 匹配 SKU=${testResult.matchedSku}`:`✗ ${testResult.error}`}</span></div>
                  </div>
                )}
              </div>

              {/* Save */}
              <div style={{display:'flex',gap:'8px'}}>
                <button onClick={save} disabled={saving} style={{padding:'9px 20px',borderRadius:'7px',background:saving?'#e2e8f0':'#2563eb',border:'none',color:saving?'#94a3b8':'white',fontWeight:600,fontSize:'13px',cursor:saving?'not-allowed':'pointer'}}>
                  {saving?'保存中...':'💾 保存规则'}
                </button>
                <button onClick={()=>setEditing(null)} style={{padding:'9px 14px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'white',color:'#475569',cursor:'pointer',fontSize:'13px'}}>取消</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
