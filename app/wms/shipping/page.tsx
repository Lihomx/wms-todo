'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

const PLATFORMS = [
  {v:'',l:'选择平台...'},{v:'MercadoLibre',l:'MercadoLibre'},{v:'Amazon',l:'Amazon'},
  {v:'Shopify',l:'Shopify'},{v:'Walmart',l:'Walmart'},{v:'TikTok',l:'TikTok'},
  {v:'Other',l:'Other'},
]
const SIG_TYPES = [{v:'',l:'无'},{v:'1',l:'间接签署'},{v:'2',l:'直接签署'},{v:'3',l:'成人签署'}]

const s_inp:React.CSSProperties={width:'100%',padding:'10px 13px',borderRadius:'8px',border:'1px solid #d1d5db',background:'#fff',color:'#111827',fontSize:'14px',outline:'none',boxSizing:'border-box' as const,transition:'border-color 0.15s'}
const s_auto:React.CSSProperties={...s_inp,background:'#f0fdf4',color:'#166534',fontWeight:500}
const s_ro:React.CSSProperties={...s_inp,background:'#f9fafb',color:'#6b7280',cursor:'not-allowed'}
const s_sel:React.CSSProperties={...s_inp,cursor:'pointer'}

function F({l,req,children,hint}:{l:string;req?:boolean;children:React.ReactNode;hint?:string}) {
  return <div><label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#374151',marginBottom:'5px'}}>{l}{req&&<span style={{color:'#ef4444',marginLeft:'2px'}}>*</span>}</label>{children}{hint&&<p style={{fontSize:'11px',color:'#9ca3af',marginTop:'3px'}}>{hint}</p>}</div>
}
function Card({title,icon,children}:{title:string;icon:string;children:React.ReactNode}) {
  return <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',overflow:'hidden',marginBottom:'14px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
    <div style={{padding:'12px 20px',background:'#f9fafb',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',gap:'8px'}}>
      <span style={{fontSize:'16px'}}>{icon}</span><span style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>{title}</span>
    </div>
    <div style={{padding:'16px 20px'}}>{children}</div>
  </div>
}

interface Sku { sku:string; productName:string; mainCode:string }

export default function ShippingPage() {
  const [origin,         setOrigin]         = useState<Record<string,string>>({})
  const [customerCode,   setCustomerCode]   = useState('')
  const [customers,      setCustomers]      = useState<{customer_code:string;customer_name:string}[]>([])
  const [channels,       setChannels]       = useState<{channelCode:string;channelName:string;carrierName:string}[]>([])
  const [channel,        setChannel]        = useState('')

  // Destination
  const [destName,    setDestName]    = useState('')
  const [destPhone,   setDestPhone]   = useState('')
  const [destEmail,   setDestEmail]   = useState('')
  const [destAddr,    setDestAddr]    = useState('')
  const [destCp,      setDestCp]      = useState('')
  const [destColonia, setDestColonia] = useState('')
  const [colonias,    setColonias]    = useState<string[]>([])
  const [destCity,    setDestCity]    = useState('')
  const [destState,   setDestState]   = useState('')
  const [cpLoading,   setCpLoading]   = useState(false)
  const [cpError,     setCpError]     = useState('')

  // Package
  const [pkgContent, setPkgContent] = useState('')
  const [pkgLength,  setPkgLength]  = useState('')
  const [pkgWidth,   setPkgWidth]   = useState('')
  const [pkgHeight,  setPkgHeight]  = useState('')
  const [pkgWeight,  setPkgWeight]  = useState('')

  // SKU search
  const [skuInput,    setSkuInput]    = useState('')
  const [skuQty,      setSkuQty]      = useState('1')
  const [skuOptions,  setSkuOptions]  = useState<Sku[]>([])
  const [skuLoading,  setSkuLoading]  = useState(false)
  const [showSkuDrop, setShowSkuDrop] = useState(false)
  const [selectedSku, setSelectedSku] = useState<Sku|null>(null)
  const skuRef = useRef<HTMLDivElement>(null)

  // Optional fields
  const [salesPlatform,   setSalesPlatform]   = useState('')
  const [storeName,       setStoreName]       = useState('')
  const [platformOrderNo, setPlatformOrderNo] = useState('')
  const [referOrderNo,    setReferOrderNo]    = useState('')
  const [signatureService,setSignatureService]= useState('')
  const [remark,          setRemark]          = useState('')

  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState<{ok:boolean;msg:string;orderNo?:string}|null>(null)

  // Load warehouse origin + clients
  useEffect(() => {
    fetch('/api/shipping/create').then(r=>r.json()).then(d=>setOrigin(d.origin||{}))
    fetch('/api/oms-clients').then(r=>r.json()).then(d=>{
      const bound = (d.clients||[]).filter((c:any)=>c.auth_status===1)
      setCustomers(bound)
      if(bound.length===1) setCustomerCode(bound[0].customer_code)
    })
  }, [])

  // Load channels when customer changes
  useEffect(() => {
    if(!customerCode) return
    fetch(`/api/lingxing/channels?whCode=LIHO&customerCode=${customerCode}`)
      .then(r=>r.json()).then(d=>setChannels(d.channels||[])).catch(()=>{})
  }, [customerCode])

  // CP lookup
  const lookupCp = useCallback(async(cp:string) => {
    if(!/^\d{5}$/.test(cp)){ setColonias([]); setCpError(''); return }
    setCpLoading(true); setCpError('')
    try {
      const r = await fetch(`/api/sepomex?cp=${cp}`)
      const d = await r.json()
      if(d.error){ setCpError(d.error); setColonias([]); setDestCity(''); setDestState('') }
      else { setColonias(d.colonias||[]); setDestCity(d.municipio||''); setDestState(d.estado||''); setDestColonia(d.colonias?.[0]||'') }
    } catch { setCpError('Error de conexión') }
    setCpLoading(false)
  }, [])
  useEffect(() => { if(destCp.length===5) lookupCp(destCp) }, [destCp, lookupCp])

  // SKU search with debounce
  const skuTimer = useRef<any>(null)
  const searchSkus = useCallback(async(q:string) => {
    if(!customerCode||q.length<1){ setSkuOptions([]); return }
    setSkuLoading(true)
    const r = await fetch(`/api/client-skus?customerCode=${customerCode}&search=${encodeURIComponent(q)}`)
    const d = await r.json()
    setSkuOptions(d.skus||[])
    setSkuLoading(false)
    setShowSkuDrop(true)
  }, [customerCode])

  const onSkuInput = (val:string) => {
    setSkuInput(val); setSelectedSku(null)
    clearTimeout(skuTimer.current)
    if(val.length>=1) skuTimer.current = setTimeout(()=>searchSkus(val), 400)
    else { setSkuOptions([]); setShowSkuDrop(false) }
  }

  // Close SKU dropdown on outside click
  useEffect(() => {
    const handler = (e:MouseEvent) => { if(skuRef.current&&!skuRef.current.contains(e.target as Node)) setShowSkuDrop(false) }
    document.addEventListener('mousedown', handler)
    return ()=>document.removeEventListener('mousedown', handler)
  }, [])

  // Sender name = "ZHENYUAN LI (A17)"
  const originName = `${origin.origin_name||'ZHENYUAN LI'} (${customerCode||'?'})`
  const originCompany = 'LIHO'

  const handleSubmit = async() => {
    if(!customerCode){ setResult({ok:false,msg:'请选择客户'}); return }
    if(!destName||!destPhone||!destAddr||!destCp||!destColonia||!destCity||!pkgWeight){
      setResult({ok:false,msg:'请填写所有必填项（标*字段）'}); return
    }
    setSubmitting(true); setResult(null)
    const r = await fetch('/api/shipping/create', {
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        customerCode,
        dest:{name:destName,phone:destPhone,email:destEmail,address:destAddr,cp:destCp,colonia:destColonia,city:destCity,state:destState},
        pkg:{content:pkgContent,length:pkgLength,width:pkgWidth,height:pkgHeight,weight:pkgWeight},
        logisticsChannel: channel,
        sku: selectedSku?.sku || skuInput || undefined,
        skuQty: Number(skuQty)||1,
        salesPlatform, storeName, platformOrderNo, referOrderNo,
        signatureService: signatureService||undefined,
        remark,
      })
    })
    const d = await r.json()
    setResult(d.error ? {ok:false,msg:`❌ ${d.error}`} : {ok:true,msg:`✅ 出库单创建成功！领星单号：${d.outboundOrderNo}`,orderNo:d.outboundOrderNo})
    if(!d.error){
      setDestName(''); setDestPhone(''); setDestEmail(''); setDestAddr('')
      setDestCp(''); setDestColonia(''); setDestCity(''); setDestState(''); setColonias([])
      setPkgContent(''); setPkgLength(''); setPkgWidth(''); setPkgHeight(''); setPkgWeight('')
      setSkuInput(''); setSelectedSku(null); setSkuQty('1')
      setSalesPlatform(''); setStoreName(''); setPlatformOrderNo(''); setReferOrderNo(''); setSignatureService(''); setRemark('')
    }
    setSubmitting(false)
  }

  const g2:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}
  const g3:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginBottom:'12px'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f3f4f6',padding:'20px'}}>
      <div style={{maxWidth:'800px',margin:'0 auto'}}>
        <div style={{marginBottom:'14px'}}>
          <h1 style={{fontSize:'19px',fontWeight:700,color:'#111827'}}>📦 Crear envío / 创建出库单</h1>
          <p style={{fontSize:'13px',color:'#6b7280',marginTop:'2px'}}>完成以下信息，自动同步到领星系统</p>
        </div>

        {/* Customer selector */}
        {customers.length>1 && (
          <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'10px',padding:'12px 16px',marginBottom:'12px'}}>
            <F l="客户 *" req>
              <select value={customerCode} onChange={e=>setCustomerCode(e.target.value)} style={s_sel}>
                <option value="">选择客户...</option>
                {customers.map(c=><option key={c.customer_code} value={c.customer_code}>{c.customer_name} ({c.customer_code})</option>)}
              </select>
            </F>
          </div>
        )}

        {/* 基础信息 - matches screenshot layout */}
        <Card title="基础信息" icon="📋">
          <div style={g3}>
            <F l="*仓库">
              <input value={`${origin.wh_code||'LIHO'} 仓库1 ${origin.wh_code||'LIHO'}`} readOnly style={s_ro}/>
            </F>
            <F l="*物流渠道">
              {channels.length>0 ? (
                <select value={channel} onChange={e=>setChannel(e.target.value)} style={s_sel}>
                  <option value="Upload_Shipping_Label">Upload_Shipping_Label</option>
                  {channels.map(c=><option key={c.channelCode} value={c.channelCode}>{c.channelName} ({c.channelCode})</option>)}
                </select>
              ) : (
                <input value={channel} onChange={e=>setChannel(e.target.value)} placeholder="Upload_Shipping_Label" style={s_inp}/>
              )}
            </F>
            <F l="销售平台">
              <select value={salesPlatform} onChange={e=>setSalesPlatform(e.target.value)} style={s_sel}>
                {PLATFORMS.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}
              </select>
            </F>
          </div>
          <div style={g3}>
            <F l="店铺">
              <input value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="店铺名称" style={s_inp}/>
            </F>
            <F l="平台单号">
              <input value={platformOrderNo} onChange={e=>setPlatformOrderNo(e.target.value)} placeholder="平台订单号" style={s_inp}/>
            </F>
            <F l="参考单号">
              <input value={referOrderNo} onChange={e=>setReferOrderNo(e.target.value)} placeholder="参考单号" style={s_inp}/>
            </F>
          </div>
          <div style={g2}>
            <F l="签名服务">
              <select value={signatureService} onChange={e=>setSignatureService(e.target.value)} style={s_sel}>
                {SIG_TYPES.map(t=><option key={t.v} value={t.v}>{t.l}</option>)}
              </select>
            </F>
            <F l="备注">
              <input value={remark} onChange={e=>setRemark(e.target.value)} placeholder={`0/255`} maxLength={255} style={s_inp}/>
            </F>
          </div>
        </Card>

        {/* Origin - READONLY */}
        <Card title="Dirección de origen / 发件地址（仓库固定）" icon="🏭">
          <div style={g2}>
            <F l="Nombre completo"><input value={originName} readOnly style={s_ro}/></F>
            <F l="Teléfono"><input value={origin.origin_phone||''} readOnly style={s_ro}/></F>
            <F l="Correo electrónico"><input value={origin.origin_email||''} readOnly style={s_ro}/></F>
            <F l="Empresa"><input value={originCompany} readOnly style={s_ro}/></F>
          </div>
          <div style={{marginBottom:'12px'}}><F l="Calle y número"><input value={origin.origin_address||''} readOnly style={s_ro}/></F></div>
          <div style={g2}>
            <F l="CP"><input value={origin.origin_cp||''} readOnly style={s_ro}/></F>
            <F l="Colonia"><input value={origin.origin_colonia||''} readOnly style={s_ro}/></F>
            <F l="Ciudad"><input value={origin.origin_city||''} readOnly style={s_ro}/></F>
            <F l="Estado"><input value={origin.origin_state||''} readOnly style={s_ro}/></F>
          </div>
        </Card>

        {/* Destination */}
        <Card title="Dirección de destino / 收件地址" icon="🏠">
          <div style={g2}>
            <F l="Nombre completo" req><input value={destName} onChange={e=>setDestName(e.target.value)} placeholder="Nombre del destinatario" style={s_inp}/></F>
            <F l="Teléfono" req><input value={destPhone} onChange={e=>setDestPhone(e.target.value.replace(/\D/g,''))} placeholder="10 dígitos" maxLength={10} style={s_inp}/></F>
            <F l="Correo electrónico"><input value={destEmail} onChange={e=>setDestEmail(e.target.value)} placeholder="opcional" style={s_inp}/></F>
          </div>
          <div style={{marginBottom:'12px'}}><F l="Calle y número" req><input value={destAddr} onChange={e=>setDestAddr(e.target.value)} placeholder="Ej: Av. Reforma 123" style={s_inp}/></F></div>
          <div style={g2}>
            <F l="Código Postal (CP)" req>
              <div style={{position:'relative'}}>
                <input value={destCp} onChange={e=>setDestCp(e.target.value.replace(/\D/g,''))} maxLength={5} placeholder="5 dígitos" style={{...s_inp,paddingRight:'32px'}}/>
                {cpLoading&&<span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',color:'#6b7280',fontSize:'12px'}}>⟳</span>}
              </div>
              {cpError&&<p style={{fontSize:'11px',color:'#dc2626',marginTop:'3px'}}>{cpError}</p>}
              {!cpError&&destCp.length===5&&colonias.length>0&&<p style={{fontSize:'11px',color:'#16a34a',marginTop:'3px'}}>✓ {colonias.length} colonias</p>}
            </F>
            <F l="Colonia" req>
              {colonias.length>0 ? <select value={destColonia} onChange={e=>setDestColonia(e.target.value)} style={s_sel}>{colonias.map(c=><option key={c} value={c}>{c}</option>)}</select>
              : <input value={destColonia} onChange={e=>setDestColonia(e.target.value)} placeholder="Ingresa el CP primero" style={s_inp}/>}
            </F>
            <F l="Ciudad / Municipio" req>
              <input value={destCity} onChange={e=>setDestCity(e.target.value)} placeholder="Auto" style={destCity?s_auto:s_inp}/>
            </F>
            <F l="Estado" req>
              <input value={destState} onChange={e=>setDestState(e.target.value)} placeholder="Auto" style={destState?s_auto:s_inp}/>
            </F>
          </div>
        </Card>

        {/* Package + SKU */}
        <Card title="Paquete / 包裹与产品" icon="📦">
          {/* SKU search */}
          <div style={{...g2,marginBottom:'14px'}}>
            <F l="SKU（领星产品编码）" hint="输入搜索或下拉选择">
              <div style={{position:'relative'}} ref={skuRef}>
                <input
                  value={selectedSku ? `${selectedSku.sku} — ${selectedSku.productName}` : skuInput}
                  onChange={e=>{onSkuInput(e.target.value)}}
                  onFocus={()=>{ if(skuOptions.length>0) setShowSkuDrop(true) }}
                  placeholder="输入SKU搜索..."
                  style={{...s_inp,paddingRight:'32px'}}
                />
                {skuLoading&&<span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',color:'#6b7280',fontSize:'12px'}}>⟳</span>}
                {!skuLoading&&skuInput&&<button onClick={()=>{setSkuInput('');setSelectedSku(null);setSkuOptions([]);setShowSkuDrop(false)}} style={{position:'absolute',right:'8px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:'16px',lineHeight:1}}>×</button>}
                {showSkuDrop&&skuOptions.length>0&&(
                  <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #e5e7eb',borderRadius:'8px',boxShadow:'0 8px 24px rgba(0,0,0,0.12)',zIndex:100,maxHeight:'220px',overflowY:'auto' as const,marginTop:'2px'}}>
                    {skuOptions.map(s=>(
                      <div key={s.sku} onClick={()=>{setSelectedSku(s);setSkuInput('');setShowSkuDrop(false)}}
                        style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #f3f4f6',display:'flex',alignItems:'center',gap:'10px'}}
                        onMouseEnter={e=>(e.currentTarget.style.background='#f9fafb')}
                        onMouseLeave={e=>(e.currentTarget.style.background='')}>
                        <div>
                          <div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{s.sku}</div>
                          <div style={{fontSize:'11px',color:'#6b7280'}}>{s.productName}</div>
                        </div>
                      </div>
                    ))}
                    {skuOptions.length===0&&<div style={{padding:'14px',textAlign:'center' as const,color:'#9ca3af',fontSize:'13px'}}>未找到匹配SKU</div>}
                  </div>
                )}
              </div>
            </F>
            <F l="数量"><input type="number" value={skuQty} onChange={e=>setSkuQty(e.target.value)} min="1" style={s_inp}/></F>
          </div>
          <div style={{marginBottom:'12px'}}><F l="Contenido / 内容物"><input value={pkgContent} onChange={e=>setPkgContent(e.target.value)} placeholder="Ej: Zapatos deportivos" style={s_inp}/></F></div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'10px'}}>
            <F l="Largo (cm)"><input type="number" value={pkgLength} onChange={e=>setPkgLength(e.target.value)} placeholder="0" min="0" style={s_inp}/></F>
            <F l="Ancho (cm)"><input type="number" value={pkgWidth} onChange={e=>setPkgWidth(e.target.value)} placeholder="0" min="0" style={s_inp}/></F>
            <F l="Alto (cm)"><input type="number" value={pkgHeight} onChange={e=>setPkgHeight(e.target.value)} placeholder="0" min="0" style={s_inp}/></F>
            <F l="Peso (kg)" req><input type="number" value={pkgWeight} onChange={e=>setPkgWeight(e.target.value)} placeholder="0.5" min="0.01" step="0.01" style={s_inp}/></F>
          </div>
        </Card>

        {/* Result */}
        {result&&(
          <div style={{padding:'14px 18px',borderRadius:'10px',marginBottom:'14px',background:result.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${result.ok?'#86efac':'#fca5a5'}`,color:result.ok?'#166534':'#991b1b',fontSize:'14px',fontWeight:500}}>
            {result.msg}
          </div>
        )}

        <button onClick={handleSubmit} disabled={submitting||!customerCode} style={{
          width:'100%',padding:'14px',borderRadius:'10px',border:'none',
          background:submitting||!customerCode?'#e5e7eb':'#2563eb',
          color:submitting||!customerCode?'#9ca3af':'white',
          fontSize:'15px',fontWeight:700,cursor:submitting||!customerCode?'not-allowed':'pointer',
          boxShadow:submitting||!customerCode?'none':'0 4px 14px rgba(37,99,235,0.3)',
        }}>
          {submitting?'⟳ Creando... / 创建中...':'✓ Crear envío / 创建出库单'}
        </button>
      </div>
    </div>
  )
}
