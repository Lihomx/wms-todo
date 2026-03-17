'use client'
import { useState, useEffect, useCallback } from 'react'

interface Origin { name:string; phone:string; email:string; company:string; address:string; cp:string; colonia:string; city:string; state:string }

const inp:React.CSSProperties = {width:'100%',padding:'10px 13px',borderRadius:'8px',border:'1px solid #d1d5db',background:'#fff',color:'#111827',fontSize:'14px',outline:'none',boxSizing:'border-box' as const,transition:'border-color 0.15s'}
const inp_auto:React.CSSProperties = {...inp, background:'#f0fdf4', color:'#166534', fontWeight:500}
const inp_ro:React.CSSProperties = {...inp, background:'#f9fafb', color:'#6b7280', cursor:'not-allowed'}

function Field({label,req,children}:{label:string;req?:boolean;children:React.ReactNode}) {
  return (
    <div>
      <label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#374151',marginBottom:'5px'}}>
        {label}{req&&<span style={{color:'#ef4444',marginLeft:'2px'}}>*</span>}
      </label>
      {children}
    </div>
  )
}

function Section({title,icon,children}:{title:string;icon:string;children:React.ReactNode}) {
  return (
    <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',overflow:'hidden',marginBottom:'16px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}}>
      <div style={{padding:'14px 20px',background:'#f9fafb',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',gap:'8px'}}>
        <span style={{fontSize:'18px'}}>{icon}</span>
        <span style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>{title}</span>
      </div>
      <div style={{padding:'18px 20px'}}>{children}</div>
    </div>
  )
}

export default function ShippingPage() {
  // Origin (warehouse - readonly)
  const [origin,    setOrigin]    = useState<Origin|null>(null)

  // Destination
  const [destName,   setDestName]   = useState('')
  const [destPhone,  setDestPhone]  = useState('')
  const [destEmail,  setDestEmail]  = useState('')
  const [destAddr,   setDestAddr]   = useState('')
  const [destCp,     setDestCp]     = useState('')
  const [destColonia,setDestColonia]= useState('')
  const [colonias,   setColonias]   = useState<string[]>([])
  const [destCity,   setDestCity]   = useState('')
  const [destState,  setDestState]  = useState('')
  const [cpLoading,  setCpLoading]  = useState(false)
  const [cpError,    setCpError]    = useState('')

  // Package
  const [pkgContent, setPkgContent] = useState('')
  const [pkgLength,  setPkgLength]  = useState('')
  const [pkgWidth,   setPkgWidth]   = useState('')
  const [pkgHeight,  setPkgHeight]  = useState('')
  const [pkgWeight,  setPkgWeight]  = useState('')

  // Logistics
  const [channels,   setChannels]   = useState<{channelCode:string;channelName:string;carrierName:string}[]>([])
  const [channel,    setChannel]    = useState('')

  // SKU (from client's products)
  const [sku,        setSku]        = useState('')
  const [skuQty,     setSkuQty]     = useState('1')

  // Customer
  const [customerCode, setCustomerCode] = useState('')
  const [clients,      setClients]      = useState<{customer_code:string;customer_name:string}[]>([])

  // Submit
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState<{ok:boolean;msg:string;orderNo?:string}|null>(null)

  // Load warehouse origin address + clients
  useEffect(()=>{
    fetch('/api/shipping/create').then(r=>r.json()).then(d=>{
      if(d.origin) setOrigin({
        name:    d.origin.origin_name    || '',
        phone:   d.origin.origin_phone   || '',
        email:   d.origin.origin_email   || '',
        company: d.origin.origin_company || '',
        address: d.origin.origin_address || '',
        cp:      d.origin.origin_cp      || '',
        colonia: d.origin.origin_colonia || '',
        city:    d.origin.origin_city    || '',
        state:   d.origin.origin_state   || '',
      })
    }).catch(()=>{})

    fetch('/api/oms-clients').then(r=>r.json()).then(d=>{
      const bound = (d.clients||[]).filter((c:any)=>c.auth_status===1)
      setClients(bound)
      if(bound.length===1) setCustomerCode(bound[0].customer_code)
    })
  },[])

  // Load channels when customer changes
  useEffect(()=>{
    if(!customerCode) return
    fetch(`/api/lingxing/channels?whCode=LIHO&customerCode=${customerCode}`)
      .then(r=>r.json()).then(d=>setChannels(d.channels||[])).catch(()=>{})
  },[customerCode])

  // CP lookup
  const lookupCp = useCallback(async(cp:string)=>{
    if(!/^\d{5}$/.test(cp)){ setColonias([]); setCpError(''); return }
    setCpLoading(true); setCpError('')
    try {
      const r = await fetch(`/api/sepomex?cp=${cp}`)
      const d = await r.json()
      if(d.error){ setCpError(d.error); setColonias([]); setDestCity(''); setDestState('') }
      else {
        setColonias(d.colonias||[])
        setDestCity(d.municipio||'')
        setDestState(d.estado||'')
        setDestColonia(d.colonias?.[0]||'')
      }
    } catch { setCpError('Error de conexión') }
    setCpLoading(false)
  },[])

  useEffect(()=>{ if(destCp.length===5) lookupCp(destCp) },[destCp,lookupCp])

  const handleSubmit = async()=>{
    if(!customerCode){ setResult({ok:false,msg:'请选择客户'}); return }
    if(!destName||!destPhone||!destAddr||!destCp||!destColonia||!destCity||!pkgWeight){
      setResult({ok:false,msg:'请填写所有必填项（标*字段）'}); return
    }
    setSubmitting(true); setResult(null)
    const r = await fetch('/api/shipping/create',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        customerCode,
        dest:{name:destName,phone:destPhone,email:destEmail,address:destAddr,cp:destCp,colonia:destColonia,city:destCity,state:destState},
        pkg:{content:pkgContent,length:pkgLength,width:pkgWidth,height:pkgHeight,weight:pkgWeight},
        logisticsChannel: channel,
        sku: sku||undefined, skuQty: Number(skuQty)||1,
      })
    })
    const d = await r.json()
    setResult(d.error
      ? {ok:false, msg:`❌ ${d.error}`}
      : {ok:true, msg:`✅ 出库单创建成功！单号：${d.outboundOrderNo}`, orderNo:d.outboundOrderNo}
    )
    if(!d.error){
      // Reset destination fields
      setDestName(''); setDestPhone(''); setDestEmail('')
      setDestAddr(''); setDestCp(''); setDestColonia('')
      setDestCity(''); setDestState(''); setColonias([])
      setSku(''); setSkuQty('1')
    }
    setSubmitting(false)
  }

  const g2:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f3f4f6',padding:'24px 20px'}}>
      <div style={{maxWidth:'760px',margin:'0 auto'}}>
        <div style={{marginBottom:'18px'}}>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#111827'}}>📦 Crear envío / 创建出库单</h1>
          <p style={{fontSize:'13px',color:'#6b7280',marginTop:'3px'}}>完成以下信息，自动同步到领星系统</p>
        </div>

        {/* Customer selector (if multiple) */}
        {clients.length > 1 && (
          <div style={{background:'#fff',border:'1px solid #e5e7eb',borderRadius:'10px',padding:'14px 18px',marginBottom:'14px'}}>
            <label style={{fontSize:'12px',fontWeight:600,color:'#374151',display:'block',marginBottom:'6px'}}>客户 *</label>
            <select value={customerCode} onChange={e=>setCustomerCode(e.target.value)} style={{...inp,cursor:'pointer'}}>
              <option value="">选择客户...</option>
              {clients.map(c=><option key={c.customer_code} value={c.customer_code}>{c.customer_name} ({c.customer_code})</option>)}
            </select>
          </div>
        )}

        {/* Origin - READONLY warehouse address */}
        <Section title="Dirección de origen / 发件地址（仓库）" icon="🏭">
          {origin ? (
            <>
              <div style={g2}>
                <Field label="Nombre completo"><input value={origin.name} readOnly style={inp_ro}/></Field>
                <Field label="Teléfono"><input value={origin.phone} readOnly style={inp_ro}/></Field>
                <Field label="Correo electrónico"><input value={origin.email} readOnly style={inp_ro}/></Field>
                <Field label="Empresa"><input value={origin.company} readOnly style={inp_ro}/></Field>
              </div>
              <div style={{marginBottom:'12px'}}><Field label="Calle y número"><input value={origin.address} readOnly style={inp_ro}/></Field></div>
              <div style={g2}>
                <Field label="Código Postal"><input value={origin.cp} readOnly style={inp_ro}/></Field>
                <Field label="Colonia"><input value={origin.colonia} readOnly style={inp_ro}/></Field>
                <Field label="Ciudad"><input value={origin.city} readOnly style={inp_ro}/></Field>
                <Field label="Estado"><input value={origin.state} readOnly style={inp_ro}/></Field>
              </div>
              <p style={{fontSize:'11px',color:'#9ca3af',marginTop:'4px'}}>ℹ️ La dirección de origen es fija (dirección del almacén LIHO)</p>
            </>
          ) : (
            <div style={{padding:'20px',textAlign:'center' as const,color:'#9ca3af',fontSize:'13px'}}>
              Cargando dirección del almacén... / 加载仓库地址中...
            </div>
          )}
        </Section>

        {/* Destination */}
        <Section title="Dirección de destino / 收件地址" icon="🏠">
          <div style={g2}>
            <Field label="Nombre completo" req><input value={destName} onChange={e=>setDestName(e.target.value)} placeholder="Nombre del destinatario" style={inp}/></Field>
            <Field label="Teléfono" req><input value={destPhone} onChange={e=>setDestPhone(e.target.value.replace(/\D/g,''))} placeholder="10 dígitos" maxLength={10} style={inp}/></Field>
            <Field label="Correo electrónico"><input value={destEmail} onChange={e=>setDestEmail(e.target.value)} placeholder="opcional" style={inp}/></Field>
          </div>
          <div style={{marginBottom:'12px'}}>
            <Field label="Calle y número" req><input value={destAddr} onChange={e=>setDestAddr(e.target.value)} placeholder="Ej: Av. Reforma 123" style={inp}/></Field>
          </div>
          <div style={g2}>
            <Field label="Código Postal (CP)" req>
              <div style={{position:'relative'}}>
                <input value={destCp} onChange={e=>setDestCp(e.target.value.replace(/\D/g,''))} maxLength={5} placeholder="5 dígitos" style={{...inp,paddingRight:'32px'}}/>
                {cpLoading&&<span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',color:'#6b7280',fontSize:'13px'}}>⟳</span>}
              </div>
              {cpError&&<p style={{fontSize:'11px',color:'#dc2626',marginTop:'4px'}}>{cpError}</p>}
              {!cpError&&destCp.length===5&&colonias.length>0&&<p style={{fontSize:'11px',color:'#16a34a',marginTop:'4px'}}>✓ CP válido — {colonias.length} colonias encontradas</p>}
            </Field>
            <Field label="Colonia" req>
              {colonias.length>0 ? (
                <select value={destColonia} onChange={e=>setDestColonia(e.target.value)} style={{...inp,cursor:'pointer'}}>
                  {colonias.map(c=><option key={c} value={c}>{c}</option>)}
                </select>
              ) : (
                <input value={destColonia} onChange={e=>setDestColonia(e.target.value)} placeholder="Ingresa el CP primero" style={inp}/>
              )}
            </Field>
            <Field label="Ciudad / Municipio" req>
              <input value={destCity} onChange={e=>setDestCity(e.target.value)} placeholder="Auto-completado" style={destCity?inp_auto:inp}/>
            </Field>
            <Field label="Estado" req>
              <input value={destState} onChange={e=>setDestState(e.target.value)} placeholder="Auto-completado" style={destState?inp_auto:inp}/>
            </Field>
          </div>
        </Section>

        {/* Package */}
        <Section title="Paquete / 包裹信息" icon="📦">
          <div style={{marginBottom:'12px'}}>
            <Field label="Contenido del paquete / 内容物"><input value={pkgContent} onChange={e=>setPkgContent(e.target.value)} placeholder="Ej: Zapatos deportivos" style={inp}/></Field>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'10px',marginBottom:'12px'}}>
            <Field label="Largo (cm)"><input type="number" value={pkgLength} onChange={e=>setPkgLength(e.target.value)} placeholder="0" min="0" style={inp}/></Field>
            <Field label="Ancho (cm)"><input type="number" value={pkgWidth} onChange={e=>setPkgWidth(e.target.value)} placeholder="0" min="0" style={inp}/></Field>
            <Field label="Alto (cm)"><input type="number" value={pkgHeight} onChange={e=>setPkgHeight(e.target.value)} placeholder="0" min="0" style={inp}/></Field>
            <Field label="Peso (kg)" req><input type="number" value={pkgWeight} onChange={e=>setPkgWeight(e.target.value)} placeholder="0.5" min="0.01" step="0.01" style={inp}/></Field>
          </div>
          <div style={g2}>
            <Field label="SKU (领星产品编码)"><input value={sku} onChange={e=>setSku(e.target.value)} placeholder="Ej: N4-37" style={inp}/></Field>
            <Field label="数量"><input type="number" value={skuQty} onChange={e=>setSkuQty(e.target.value)} min="1" style={inp}/></Field>
          </div>
        </Section>

        {/* Logistics channel */}
        <Section title="Servicio logístico / 物流渠道" icon="🚚">
          {channels.length>0 ? (
            <Field label="Canal logístico">
              <select value={channel} onChange={e=>setChannel(e.target.value)} style={{...inp,cursor:'pointer'}}>
                <option value="Upload_Shipping_Label">Upload_Shipping_Label（自上传面单）</option>
                {channels.map(c=><option key={c.channelCode} value={c.channelCode}>{c.channelName} — {c.carrierName}</option>)}
              </select>
            </Field>
          ) : (
            <div>
              <Field label="Canal logístico">
                <input value={channel} onChange={e=>setChannel(e.target.value)} placeholder="Upload_Shipping_Label" style={inp}/>
              </Field>
              <p style={{fontSize:'11px',color:'#9ca3af',marginTop:'5px'}}>Los canales se cargarán automáticamente al seleccionar el cliente</p>
            </div>
          )}
        </Section>

        {/* Result */}
        {result && (
          <div style={{padding:'14px 18px',borderRadius:'10px',marginBottom:'16px',background:result.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${result.ok?'#86efac':'#fca5a5'}`,color:result.ok?'#166534':'#991b1b',fontSize:'14px',fontWeight:500}}>
            {result.msg}
            {result.orderNo && <div style={{fontSize:'12px',marginTop:'4px',color:'#166534'}}>领星出库单号：{result.orderNo}</div>}
          </div>
        )}

        {/* Submit */}
        <button onClick={handleSubmit} disabled={submitting||!customerCode} style={{
          width:'100%', padding:'14px', borderRadius:'10px', border:'none',
          background: submitting||!customerCode ? '#e5e7eb' : '#2563eb',
          color: submitting||!customerCode ? '#9ca3af' : 'white',
          fontSize:'15px', fontWeight:700, cursor: submitting||!customerCode ? 'not-allowed' : 'pointer',
          boxShadow: submitting||!customerCode ? 'none' : '0 4px 14px rgba(37,99,235,0.35)',
          transition:'all 0.15s',
        }}>
          {submitting ? '⟳ Creando envío... / 创建中...' : '✓ Crear envío / 创建出库单'}
        </button>
      </div>
    </div>
  )
}
