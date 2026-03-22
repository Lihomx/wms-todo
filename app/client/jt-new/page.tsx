'use client'
import { useState, useEffect, useCallback, useRef } from 'react'

import { jtApi } from '@/lib/jt-api'
const api = jtApi

const inp:React.CSSProperties={width:'100%',padding:'10px 12px',border:'1.5px solid #e0dbd2',borderRadius:'6px',fontSize:'14px',outline:'none',fontFamily:'inherit',boxSizing:'border-box' as const,background:'#fff',color:'#1a1714'}
const sel:React.CSSProperties={...inp,cursor:'pointer',backgroundImage:"url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%236b6560' fill='none' stroke-width='1.5' stroke-linecap='round'/%3E%3C/svg%3E\")",backgroundRepeat:'no-repeat',backgroundPosition:'right 12px center',paddingRight:'32px',appearance:'none' as const}
const lbl=(t:string,req?:boolean)=><label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#6b6560',textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:'6px'}}>{t}{req&&<span style={{color:'#d63030',marginLeft:'2px'}}>*</span>}</label>
const g2:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'14px'}
const g3:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginBottom:'14px'}
const card:React.CSSProperties={background:'#fff',border:'1px solid #e0dbd2',borderRadius:'10px',padding:'20px',marginBottom:'16px'}

interface Item { name_en:string; name_cn:string; qty:number; price:number; weight:number; note:string }

export default function JTNewOrder() {
  const sess = (() => { try { return JSON.parse(sessionStorage.getItem('wms_client_session')||'null') } catch { return null } })()

  // Origin (from config - readonly)
  const [shipper,    setShipper]    = useState<any>({})

  // Destination
  const [clientCode, setClientCode] = useState('')
  const [consName,   setConsName]   = useState('')
  const [consCompany,setConsCompany]= useState('')
  const [consPhone,  setConsPhone]  = useState('')
  const [cpDest,     setCpDest]     = useState('')
  const [colonias,   setColonias]   = useState<string[]>([])
  const [colonia,    setColonia]    = useState('')
  const [city,       setCity]       = useState('')
  const [state,      setState]      = useState('')
  const [street,     setStreet]     = useState('')
  const [interior,   setInterior]   = useState('')
  const [reference,  setReference]  = useState('')
  const [cpLoading,  setCpLoading]  = useState(false)
  const [cpError,    setCpError]    = useState('')

  // Package
  const [cargoType,  setCargoType]  = useState('4')
  const [cargoContent,setCargoContent]=useState('')
  const [largo,      setLargo]      = useState('')
  const [ancho,      setAncho]      = useState('')
  const [alto,       setAlto]       = useState('')
  const [weight,     setWeight]     = useState('')
  const [pieces,     setPieces]     = useState('1')
  const [notes,      setNotes]      = useState('')
  const [items,      setItems]      = useState<Item[]>([{ name_en:'Goods', name_cn:'货物', qty:1, price:1, weight:0.1, note:'' }])

  // Address book
  const [savedAddrs, setSavedAddrs] = useState<any[]>([])

  // Submit state
  const [submitting, setSubmitting] = useState(false)
  const [result,     setResult]     = useState<any>(null)
  const [err,        setErr]        = useState('')

  // Load clientCode from WMS session
  useEffect(()=>{
    const s = typeof window!=='undefined' ? (() => { try { return JSON.parse(sessionStorage.getItem('wms_client_session')||'null') } catch { return null } })() : null
    if(s?.customerCode) setClientCode(s.customerCode)
  },[])

  // Load shipper + saved addresses
  useEffect(()=>{
    fetch('/api/jt?action=get_config',{method:'GET'}).then(()=>{}) // warm up
    api('get_config',{}).then(d=>setShipper(d.shipper||{})).catch(()=>{})
    api('get_addresses',{}).then(setSavedAddrs).catch(()=>{})
    // Pre-fill client code from session
    if(sess?.clientCode) setClientCode(sess.clientCode)
  },[])

  // CP lookup
  useEffect(()=>{
    if(!/^\d{5}$/.test(cpDest)) { setColonias([]); setCpError(''); return }
    setCpLoading(true); setCpError('')
    fetch(`/api/sepomex?cp=${cpDest}`).then(r=>r.json()).then(d=>{
      if(d.error){ setCpError(d.error); setColonias([]); setCity(''); setState('') }
      else { setColonias(d.colonias||[]); setCity(d.municipio||''); setState(d.estado||''); setColonia(d.colonias?.[0]||'') }
      setCpLoading(false)
    }).catch(()=>setCpLoading(false))
  },[cpDest])

  const volWeight = ((parseFloat(largo)||0)*(parseFloat(ancho)||0)*(parseFloat(alto)||0)/5000).toFixed(3)

  const fillAddress = (addr: any) => {
    setConsName(addr.name||''); setConsCompany(addr.company||'')
    setConsPhone(addr.phone||''); setCpDest(addr.postcode||'')
    setColonia(addr.colonia||''); setCity(addr.city||''); setState(addr.state||'')
    setStreet(addr.street||''); setInterior(addr.interior||''); setReference(addr.reference||'')
  }

  const submit = async() => {
    if(!clientCode || !consName || !consPhone || !cpDest || !colonia || !city || !street || !weight) {
      setErr('请填写所有必填项（标*字段）'); return
    }
    setSubmitting(true); setErr('')
    const refNo = `${clientCode}-${Date.now()}`
    try {
      const d = await api('create_order', { order: {
        reference_no:        refNo,
        client_code:         clientCode,
        client_name:         sess?.name||'',
        consignee_name:      consName,
        consignee_company:   consCompany,
        consignee_phone:     consPhone,
        consignee_postcode:  cpDest,
        consignee_colonia:   colonia,
        shipping_city:       city,
        shipping_state:      state,
        consignee_street:    street,
        consignee_interior:  interior,
        consignee_reference: reference,
        cargo_type:          cargoType,
        cargo_content:       cargoContent,
        largo, ancho, alto, weight, pieces, notes,
        items,
      }})
      setResult({ ...d, refNo })
    } catch(e:any) { setErr(e.message) }
    setSubmitting(false)
  }

  if (result) return (
    <div style={{maxWidth:'620px',margin:'0 auto'}}>
      <div style={{...card,background:'#e8f8ef',border:'1px solid #b4e8cb',textAlign:'center' as const,padding:'32px'}}>
        <div style={{fontSize:'40px',marginBottom:'12px'}}>✅</div>
        <h2 style={{fontSize:'18px',fontWeight:700,marginBottom:'8px',color:'#1a1714'}}>
          {sess?.lang==='zh'?'提交成功，等待管理员审核':'¡Enviado! En espera de revisión'}
        </h2>
        <div style={{fontSize:'13px',color:'#2a9d5c',lineHeight:1.8}}>
          <div>📋 Ref: <strong>{result.refNo}</strong></div>
          <div>⏳ El administrador verificará la información y sincronizará con J&T</div>
        </div>
        <div style={{display:'flex',gap:'10px',justifyContent:'center',marginTop:'20px'}}>
          <button onClick={()=>setResult(null)} style={{padding:'10px 20px',borderRadius:'6px',background:'#e85d2f',color:'#fff',border:'none',cursor:'pointer',fontWeight:600,fontSize:'14px',fontFamily:'inherit'}}>+ Crear otra / 再建一单</button>
          <a href="/jt/orders" style={{padding:'10px 20px',borderRadius:'6px',background:'#f5f4f0',color:'#1a1714',border:'1px solid #e0dbd2',textDecoration:'none',fontWeight:600,fontSize:'14px',display:'flex',alignItems:'center'}}>Ver mis guías →</a>
        </div>
      </div>
    </div>
  )

  return (
    <div style={{maxWidth:'800px',margin:'0 auto'}}>
      <div style={{marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px',fontWeight:700,color:'#1a1714'}}>Nueva guía / 创建面单</h1>
        <p style={{fontSize:'13px',color:'#6b6560',marginTop:'3px'}}>Complete la información de envío</p>
      </div>

      {/* Client code */}
      <div style={card}>
        <div style={{fontSize:'15px',fontWeight:700,marginBottom:'14px',display:'flex',alignItems:'center',gap:'8px'}}>📋 Información básica</div>
        <div><div>{lbl('Código de cliente *',true)}<input value={clientCode} onChange={e=>setClientCode(e.target.value)} placeholder="Ej: LIHO001" style={inp}/></div></div>
      </div>

      {/* Origin - readonly */}
      <div style={card}>
        <div style={{fontSize:'15px',fontWeight:700,marginBottom:'12px',display:'flex',alignItems:'center',gap:'8px'}}>🏭 Dirección de origen / 发件地址</div>
        <div style={{background:'#eef2ff',border:'1px solid #c0cef5',borderRadius:'6px',padding:'10px 14px',fontSize:'12px',color:'#2a4480',marginBottom:'14px',display:'flex',alignItems:'center',gap:'8px'}}>
          📍 Configurada por el administrador — no modificable / 由管理员配置，不可修改
        </div>
        {shipper.name ? (
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',fontSize:'13px'}}>
            <div><span style={{color:'#6b6560',fontSize:'11px',fontWeight:600}}>NOMBRE: </span>{shipper.name}</div>
            <div><span style={{color:'#6b6560',fontSize:'11px',fontWeight:600}}>TEL: </span>{shipper.telephone}</div>
            <div style={{gridColumn:'1/-1'}}><span style={{color:'#6b6560',fontSize:'11px',fontWeight:600}}>DIRECCIÓN: </span>{shipper.street}, CP {shipper.postcode}, {shipper.city}, {shipper.province}</div>
          </div>
        ) : <div style={{fontSize:'13px',color:'#6b6560'}}>⚠ Sin dirección de origen — el admin debe configurarla.</div>}
      </div>

      {/* Destination */}
      <div style={card}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
          <div style={{fontSize:'15px',fontWeight:700,display:'flex',alignItems:'center',gap:'8px'}}>🏠 Dirección de destino / 收件地址</div>
          {savedAddrs.length > 0 && (
            <select onChange={e=>{ const a=savedAddrs.find(x=>x.id===e.target.value); if(a) fillAddress(a) }}
              style={{...sel,width:'220px',fontSize:'12px',padding:'6px 32px 6px 10px'}}>
              <option value="">📚 Mis direcciones...</option>
              {savedAddrs.map(a=><option key={a.id} value={a.id}>{a.alias}</option>)}
            </select>
          )}
        </div>
        <div style={g2}>
          <div>{lbl('Nombre completo *',true)}<input value={consName} onChange={e=>setConsName(e.target.value)} placeholder="Nombre del destinatario" style={inp}/></div>
          <div>{lbl('Empresa')}<input value={consCompany} onChange={e=>setConsCompany(e.target.value)} placeholder="Empresa (opcional)" style={inp}/></div>
          <div>{lbl('Teléfono *',true)}<input value={consPhone} onChange={e=>setConsPhone(e.target.value)} placeholder="10 dígitos" style={inp}/></div>
        </div>
        <div style={{marginBottom:'14px'}}>{lbl('Calle y número *',true)}<input value={street} onChange={e=>setStreet(e.target.value)} placeholder="Ej: Av. Reforma 123" style={inp}/></div>
        <div style={g2}>
          <div>
            {lbl('Código Postal *',true)}
            <div style={{position:'relative'}}>
              <input value={cpDest} onChange={e=>setCpDest(e.target.value.replace(/\D/g,''))} maxLength={5} placeholder="5 dígitos" style={{...inp,paddingRight:'32px'}}/>
              {cpLoading && <span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',fontSize:'13px',color:'#6b6560'}}>⟳</span>}
            </div>
            {cpError && <div style={{fontSize:'11px',color:'#d63030',marginTop:'3px'}}>{cpError}</div>}
            {!cpError && colonias.length > 0 && <div style={{fontSize:'11px',color:'#2a9d5c',marginTop:'3px'}}>✓ {colonias.length} colonias encontradas</div>}
          </div>
          <div>
            {lbl('Colonia *',true)}
            {colonias.length > 0
              ? <select value={colonia} onChange={e=>setColonia(e.target.value)} style={sel}>{colonias.map(c=><option key={c} value={c}>{c}</option>)}</select>
              : <input value={colonia} onChange={e=>setColonia(e.target.value)} placeholder="Ingresa el CP primero" style={inp}/>}
          </div>
          <div>{lbl('Ciudad *',true)}<input value={city} onChange={e=>setCity(e.target.value)} style={{...inp,background:city?'#f0fff4':'#fff',color:city?'#1a5c2a':'#1a1714'}} placeholder="Auto-completado"/></div>
          <div>{lbl('Estado *',true)}<input value={state} onChange={e=>setState(e.target.value)} style={{...inp,background:state?'#f0fff4':'#fff',color:state?'#1a5c2a':'#1a1714'}} placeholder="Auto-completado"/></div>
        </div>
        <div style={g2}>
          <div>{lbl('Interior / Número')}<input value={interior} onChange={e=>setInterior(e.target.value)} placeholder="Núm. interior, depto, etc." style={inp}/></div>
          <div>{lbl('Referencias')}<input value={reference} onChange={e=>setReference(e.target.value)} placeholder="Entre calles, puntos de referencia" style={inp}/></div>
        </div>
      </div>

      {/* Package */}
      <div style={card}>
        <div style={{fontSize:'15px',fontWeight:700,marginBottom:'14px',display:'flex',alignItems:'center',gap:'8px'}}>📦 Paquete / 包裹信息</div>
        <div style={g2}>
          <div>
            {lbl('Tipo de carga')}
            <select value={cargoType} onChange={e=>setCargoType(e.target.value)} style={sel}>
              <option value="1">Documentos</option>
              <option value="2">Mercancía / 商品</option>
              <option value="3">Electrónica</option>
              <option value="4">General / 普货</option>
            </select>
          </div>
          <div>{lbl('Contenido')}<input value={cargoContent} onChange={e=>setCargoContent(e.target.value)} placeholder="Ej: Zapatos deportivos" style={inp}/></div>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr 1fr',gap:'10px',marginBottom:'14px'}}>
          <div>{lbl('Largo (cm)')}<input type="number" value={largo} onChange={e=>setLargo(e.target.value)} min="0" placeholder="0" style={inp}/></div>
          <div>{lbl('Ancho (cm)')}<input type="number" value={ancho} onChange={e=>setAncho(e.target.value)} min="0" placeholder="0" style={inp}/></div>
          <div>{lbl('Alto (cm)')}<input type="number" value={alto} onChange={e=>setAlto(e.target.value)} min="0" placeholder="0" style={inp}/></div>
          <div>{lbl('Peso (kg) *',true)}<input type="number" value={weight} onChange={e=>setWeight(e.target.value)} min="0.01" step="0.01" placeholder="0.5" style={inp}/></div>
          <div>{lbl('Piezas')}<input type="number" value={pieces} onChange={e=>setPieces(e.target.value)} min="1" style={inp}/></div>
        </div>
        {largo && ancho && alto && <div style={{fontSize:'12px',color:'#2a4480',marginBottom:'12px'}}>📐 Peso volumétrico: <strong>{volWeight} kg</strong></div>}
        <div>{lbl('Notas internas')}<input value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Notas para el administrador (no se envían a J&T)" style={inp}/></div>
      </div>

      {/* Invoice items */}
      <div style={card}>
        <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'14px'}}>
          <div style={{fontSize:'15px',fontWeight:700,display:'flex',alignItems:'center',gap:'8px'}}>🧾 Artículos (Invoice)</div>
          <button onClick={()=>setItems([...items,{name_en:'',name_cn:'',qty:1,price:1,weight:0.1,note:''}])} style={{padding:'5px 12px',borderRadius:'6px',background:'#f5f4f0',border:'1px solid #e0dbd2',cursor:'pointer',fontSize:'12px',fontWeight:600}}>+ Agregar</button>
        </div>
        {items.map((it,i)=>(
          <div key={i} style={{display:'grid',gridTemplateColumns:'2fr 2fr 1fr 1fr 1fr auto',gap:'8px',marginBottom:'8px',alignItems:'end'}}>
            <div>{i===0&&<label style={{fontSize:'11px',color:'#6b6560',fontWeight:600,display:'block',marginBottom:'4px'}}>Nombre EN</label>}<input value={it.name_en} onChange={e=>{const n=[...items];n[i].name_en=e.target.value;setItems(n)}} placeholder="Product name" style={{...inp,fontSize:'12px',padding:'8px 10px'}}/></div>
            <div>{i===0&&<label style={{fontSize:'11px',color:'#6b6560',fontWeight:600,display:'block',marginBottom:'4px'}}>Nombre CN</label>}<input value={it.name_cn} onChange={e=>{const n=[...items];n[i].name_cn=e.target.value;setItems(n)}} placeholder="产品名称" style={{...inp,fontSize:'12px',padding:'8px 10px'}}/></div>
            <div>{i===0&&<label style={{fontSize:'11px',color:'#6b6560',fontWeight:600,display:'block',marginBottom:'4px'}}>Qty</label>}<input type="number" value={it.qty} onChange={e=>{const n=[...items];n[i].qty=parseInt(e.target.value)||1;setItems(n)}} min="1" style={{...inp,fontSize:'12px',padding:'8px 10px'}}/></div>
            <div>{i===0&&<label style={{fontSize:'11px',color:'#6b6560',fontWeight:600,display:'block',marginBottom:'4px'}}>Precio $</label>}<input type="number" value={it.price} onChange={e=>{const n=[...items];n[i].price=parseFloat(e.target.value)||1;setItems(n)}} min="0.01" step="0.01" style={{...inp,fontSize:'12px',padding:'8px 10px'}}/></div>
            <div>{i===0&&<label style={{fontSize:'11px',color:'#6b6560',fontWeight:600,display:'block',marginBottom:'4px'}}>Peso kg</label>}<input type="number" value={it.weight} onChange={e=>{const n=[...items];n[i].weight=parseFloat(e.target.value)||0.1;setItems(n)}} min="0.001" step="0.001" style={{...inp,fontSize:'12px',padding:'8px 10px'}}/></div>
            <div style={{paddingBottom:'1px'}}>{items.length>1&&<button onClick={()=>setItems(items.filter((_,j)=>j!==i))} style={{padding:'8px 10px',borderRadius:'6px',background:'#fde8e8',border:'1px solid #f4b4b4',color:'#d63030',cursor:'pointer',fontSize:'12px'}}>✕</button>}</div>
          </div>
        ))}
      </div>

      {err && <div style={{padding:'12px 16px',borderRadius:'6px',background:'#fde8e8',border:'1px solid #f4b4b4',color:'#d63030',fontSize:'13px',marginBottom:'14px'}}>⚠ {err}</div>}
      <button onClick={submit} disabled={submitting} style={{width:'100%',padding:'14px',borderRadius:'8px',background:submitting?'#e0dbd2':'#e85d2f',color:submitting?'#6b6560':'#fff',border:'none',fontSize:'15px',fontWeight:700,cursor:submitting?'not-allowed':'pointer',fontFamily:'inherit',boxShadow:submitting?'none':'0 4px 14px rgba(232,93,47,0.3)'}}>
        {submitting ? '⟳ Enviando...' : '✓ Enviar orden / 提交订单'}
      </button>
    </div>
  )
}
