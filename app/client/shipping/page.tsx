'use client'
import { useEffect, useState } from 'react'

// Reuse the same WMS shipping page but inject customerCode from session
export default function ClientShippingPage() {
  const [customerCode, setCustomerCode] = useState('')
  const [ready,        setReady]        = useState(false)

  useEffect(()=>{
    fetch('/api/auth-info').then(r=>r.json()).then(info=>{
      setCustomerCode(info.customerCode||'')
      setReady(true)
    })
  },[])

  if(!ready) return <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',color:'#94a3b8'}}>加载中...</div>

  // Dynamically import the WMS shipping page and inject the customer code
  // For now: render inline iframe-style redirect with customerCode pre-set
  return <ShippingWithCustomer customerCode={customerCode} />
}

// Inline shipping form for client - same as wms/shipping but with locked customerCode
function ShippingWithCustomer({customerCode}:{customerCode:string}) {
  const [origin,         setOrigin]         = useState<Record<string,string>>({})
  const [channels,       setChannels]       = useState<any[]>([])
  const [channel,        setChannel]        = useState('')
  const [destName,       setDestName]       = useState('')
  const [destPhone,      setDestPhone]      = useState('')
  const [destEmail,      setDestEmail]      = useState('')
  const [destAddr,       setDestAddr]       = useState('')
  const [destCp,         setDestCp]         = useState('')
  const [destColonia,    setDestColonia]    = useState('')
  const [colonias,       setColonias]       = useState<string[]>([])
  const [destCity,       setDestCity]       = useState('')
  const [destState,      setDestState]      = useState('')
  const [cpLoading,      setCpLoading]      = useState(false)
  const [cpError,        setCpError]        = useState('')
  const [pkgContent,     setPkgContent]     = useState('')
  const [pkgLength,      setPkgLength]      = useState('')
  const [pkgWidth,       setPkgWidth]       = useState('')
  const [pkgHeight,      setPkgHeight]      = useState('')
  const [pkgWeight,      setPkgWeight]      = useState('')
  const [skuInput,       setSkuInput]       = useState('')
  const [skuQty,         setSkuQty]         = useState('1')
  const [skuOptions,     setSkuOptions]     = useState<any[]>([])
  const [skuLoading,     setSkuLoading]     = useState(false)
  const [showSkuDrop,    setShowSkuDrop]    = useState(false)
  const [selectedSku,    setSelectedSku]    = useState<any>(null)
  const [salesPlatform,  setSalesPlatform]  = useState('')
  const [storeName,      setStoreName]      = useState('')
  const [platformOrderNo,setPlatformOrderNo]= useState('')
  const [referOrderNo,   setReferOrderNo]   = useState('')
  const [signatureService,setSig]           = useState('')
  const [remark,         setRemark]         = useState('')
  const [submitting,     setSubmitting]     = useState(false)
  const [result,         setResult]         = useState<{ok:boolean;msg:string}|null>(null)

  const PLATFORMS = [
    {v:'',l:'选择平台'},{v:'MercadoLibre',l:'MercadoLibre'},{v:'Amazon',l:'Amazon'},
    {v:'Shopify',l:'Shopify'},{v:'Walmart',l:'Walmart'},{v:'TikTok',l:'TikTok'},{v:'Other',l:'Other'},
  ]

  useEffect(()=>{
    fetch('/api/shipping/create').then(r=>r.json()).then(d=>setOrigin(d.origin||{}))
    fetch(`/api/lingxing/channels?whCode=LIHO&customerCode=${customerCode}`)
      .then(r=>r.json()).then(d=>setChannels(d.channels||[])).catch(()=>{})
  },[customerCode])

  useEffect(()=>{
    if(!/^\d{5}$/.test(destCp)) return
    setCpLoading(true); setCpError('')
    fetch(`/api/sepomex?cp=${destCp}`).then(r=>r.json()).then(d=>{
      if(d.error){ setCpError(d.error); setColonias([]); setDestCity(''); setDestState('') }
      else { setColonias(d.colonias||[]); setDestCity(d.municipio||''); setDestState(d.estado||''); setDestColonia(d.colonias?.[0]||'') }
      setCpLoading(false)
    }).catch(()=>setCpLoading(false))
  },[destCp])

  const searchSku = (v:string) => {
    setSkuInput(v); setSelectedSku(null)
    if(v.length<1){ setSkuOptions([]); setShowSkuDrop(false); return }
    setSkuLoading(true)
    setTimeout(()=>{
      fetch(`/api/client-skus?customerCode=${customerCode}&search=${encodeURIComponent(v)}`)
        .then(r=>r.json()).then(d=>{ setSkuOptions(d.skus||[]); setShowSkuDrop(true); setSkuLoading(false) })
    }, 400)
  }

  const submit = async()=>{
    if(!destName||!destPhone||!destAddr||!destCp||!destColonia||!destCity||!pkgWeight){
      setResult({ok:false,msg:'请填写所有必填字段（标*）'}); return
    }
    setSubmitting(true); setResult(null)
    const r = await fetch('/api/shipping/create',{
      method:'POST', headers:{'Content-Type':'application/json'},
      body: JSON.stringify({
        customerCode,
        dest:{name:destName,phone:destPhone,email:destEmail,address:destAddr,cp:destCp,colonia:destColonia,city:destCity,state:destState},
        pkg:{content:pkgContent,length:pkgLength,width:pkgWidth,height:pkgHeight,weight:pkgWeight},
        logisticsChannel:channel, sku:selectedSku?.sku||skuInput||undefined, skuQty:Number(skuQty)||1,
        salesPlatform,storeName,platformOrderNo,referOrderNo,signatureService:signatureService||undefined,remark,
      })
    })
    const d = await r.json()
    setResult(d.error?{ok:false,msg:`❌ ${d.error}`}:{ok:true,msg:`✅ 出库单创建成功！单号：${d.outboundOrderNo}`})
    if(!d.error){
      setDestName('');setDestPhone('');setDestEmail('');setDestAddr('');setDestCp('');setDestColonia('');setDestCity('');setDestState('');setColonias([])
      setPkgContent('');setPkgLength('');setPkgWidth('');setPkgHeight('');setPkgWeight('')
      setSkuInput('');setSelectedSku(null);setSalesPlatform('');setStoreName('');setPlatformOrderNo('');setReferOrderNo('');setSig('');setRemark('')
    }
    setSubmitting(false)
  }

  const I:React.CSSProperties={width:'100%',padding:'10px 13px',borderRadius:'8px',border:'1px solid #d1d5db',background:'#fff',color:'#111827',fontSize:'14px',outline:'none',boxSizing:'border-box' as const}
  const Iro:React.CSSProperties={...I,background:'#f9fafb',color:'#6b7280',cursor:'not-allowed'}
  const Iok:React.CSSProperties={...I,background:'#f0fdf4',color:'#166534',fontWeight:500}
  const g2:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}
  const g3:React.CSSProperties={display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'12px',marginBottom:'12px'}
  const lbl=(t:string,req?:boolean)=><label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#374151',marginBottom:'5px'}}>{t}{req&&<span style={{color:'#ef4444',marginLeft:'2px'}}>*</span>}</label>
  const sec=(t:string,ico:string)=><div style={{padding:'12px 20px',background:'#f9fafb',borderBottom:'1px solid #e5e7eb',display:'flex',alignItems:'center',gap:'8px'}}><span style={{fontSize:'16px'}}>{ico}</span><span style={{fontSize:'14px',fontWeight:700,color:'#111827'}}>{t}</span></div>
  const card:React.CSSProperties={background:'#fff',border:'1px solid #e5e7eb',borderRadius:'12px',overflow:'hidden',marginBottom:'14px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}
  const originName=`${origin.origin_name||'ZHENYUAN LI'} (${customerCode})`

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f3f4f6',padding:'20px'}}>
      <div style={{maxWidth:'800px',margin:'0 auto'}}>
        <div style={{marginBottom:'14px'}}>
          <h1 style={{fontSize:'19px',fontWeight:700,color:'#111827'}}>📦 Crear envío / 创建出库单</h1>
          <p style={{fontSize:'13px',color:'#6b7280'}}>为客户 <strong>{customerCode}</strong> 创建出库单，自动同步到领星系统</p>
        </div>

        {/* Basic info */}
        <div style={card}>
          {sec('基础信息','📋')}
          <div style={{padding:'16px 20px'}}>
            <div style={g3}>
              <div>{lbl('仓库')}<input value={`${origin.wh_code||'LIHO'} 仓库1`} readOnly style={Iro}/></div>
              <div>{lbl('物流渠道 *',true)}{channels.length>0?
                <select value={channel} onChange={e=>setChannel(e.target.value)} style={{...I,cursor:'pointer'}}>
                  <option value="Upload_Shipping_Label">Upload_Shipping_Label</option>
                  {channels.map((c:any)=><option key={c.channelCode} value={c.channelCode}>{c.channelName} ({c.channelCode})</option>)}
                </select>:
                <input value={channel} onChange={e=>setChannel(e.target.value)} placeholder="Upload_Shipping_Label" style={I}/>}
              </div>
              <div>{lbl('销售平台')}<select value={salesPlatform} onChange={e=>setSalesPlatform(e.target.value)} style={{...I,cursor:'pointer'}}>{PLATFORMS.map(p=><option key={p.v} value={p.v}>{p.l}</option>)}</select></div>
            </div>
            <div style={g3}>
              <div>{lbl('店铺')}<input value={storeName} onChange={e=>setStoreName(e.target.value)} placeholder="店铺名称" style={I}/></div>
              <div>{lbl('平台单号')}<input value={platformOrderNo} onChange={e=>setPlatformOrderNo(e.target.value)} placeholder="平台订单号" style={I}/></div>
              <div>{lbl('参考单号')}<input value={referOrderNo} onChange={e=>setReferOrderNo(e.target.value)} placeholder="参考单号" style={I}/></div>
            </div>
            <div style={g2}>
              <div>{lbl('签名服务')}<select value={signatureService} onChange={e=>setSig(e.target.value)} style={{...I,cursor:'pointer'}}>
                <option value="">无</option><option value="1">间接签署</option><option value="2">直接签署</option><option value="3">成人签署</option>
              </select></div>
              <div>{lbl('备注')}<input value={remark} onChange={e=>setRemark(e.target.value)} placeholder="0/255" maxLength={255} style={I}/></div>
            </div>
          </div>
        </div>

        {/* Origin */}
        <div style={card}>
          {sec('Dirección de origen / 发件地址','🏭')}
          <div style={{padding:'16px 20px'}}>
            <div style={g2}>
              <div>{lbl('Nombre completo')}<input value={originName} readOnly style={Iro}/></div>
              <div>{lbl('Teléfono')}<input value={origin.origin_phone||''} readOnly style={Iro}/></div>
              <div>{lbl('Empresa')}<input value="LIHO" readOnly style={Iro}/></div>
              <div>{lbl('CP')}<input value={origin.origin_cp||''} readOnly style={Iro}/></div>
            </div>
          </div>
        </div>

        {/* Destination */}
        <div style={card}>
          {sec('Dirección de destino / 收件地址','🏠')}
          <div style={{padding:'16px 20px'}}>
            <div style={g2}>
              <div>{lbl('Nombre completo',true)}<input value={destName} onChange={e=>setDestName(e.target.value)} placeholder="Destinatario" style={I}/></div>
              <div>{lbl('Teléfono',true)}<input value={destPhone} onChange={e=>setDestPhone(e.target.value.replace(/\D/g,''))} placeholder="10 dígitos" maxLength={10} style={I}/></div>
              <div>{lbl('Correo electrónico')}<input value={destEmail} onChange={e=>setDestEmail(e.target.value)} placeholder="opcional" style={I}/></div>
            </div>
            <div style={{marginBottom:'12px'}}>{lbl('Calle y número',true)}<input value={destAddr} onChange={e=>setDestAddr(e.target.value)} placeholder="Av. Ejemplo 123" style={I}/></div>
            <div style={g2}>
              <div>{lbl('Código Postal',true)}
                <div style={{position:'relative'}}>
                  <input value={destCp} onChange={e=>setDestCp(e.target.value.replace(/\D/g,''))} maxLength={5} placeholder="00000" style={{...I,paddingRight:'32px'}}/>
                  {cpLoading&&<span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',fontSize:'12px',color:'#6b7280'}}>⟳</span>}
                </div>
                {cpError&&<p style={{fontSize:'11px',color:'#dc2626',marginTop:'3px'}}>{cpError}</p>}
                {!cpError&&colonias.length>0&&<p style={{fontSize:'11px',color:'#16a34a',marginTop:'3px'}}>✓ {colonias.length} colonias</p>}
              </div>
              <div>{lbl('Colonia',true)}{colonias.length>0?<select value={destColonia} onChange={e=>setDestColonia(e.target.value)} style={{...I,cursor:'pointer'}}>{colonias.map(c=><option key={c} value={c}>{c}</option>)}</select>:<input value={destColonia} onChange={e=>setDestColonia(e.target.value)} style={I}/>}</div>
              <div>{lbl('Ciudad',true)}<input value={destCity} onChange={e=>setDestCity(e.target.value)} style={destCity?Iok:I}/></div>
              <div>{lbl('Estado',true)}<input value={destState} onChange={e=>setDestState(e.target.value)} style={destState?Iok:I}/></div>
            </div>
          </div>
        </div>

        {/* Package */}
        <div style={card}>
          {sec('Paquete / 包裹与SKU','📦')}
          <div style={{padding:'16px 20px'}}>
            <div style={{...g2,marginBottom:'14px'}}>
              <div>{lbl('SKU')}
                <div style={{position:'relative'}}>
                  <input value={selectedSku?`${selectedSku.sku} — ${selectedSku.productName}`:skuInput} onChange={e=>searchSku(e.target.value)}
                    onFocus={()=>skuOptions.length>0&&setShowSkuDrop(true)} placeholder="输入SKU搜索..." style={{...I,paddingRight:'32px'}}/>
                  {skuLoading&&<span style={{position:'absolute',right:'10px',top:'50%',transform:'translateY(-50%)',fontSize:'12px',color:'#6b7280'}}>⟳</span>}
                  {selectedSku&&<button onClick={()=>{setSelectedSku(null);setSkuInput('');setSkuOptions([]);setShowSkuDrop(false)}} style={{position:'absolute',right:'8px',top:'50%',transform:'translateY(-50%)',background:'none',border:'none',cursor:'pointer',color:'#9ca3af',fontSize:'16px'}}>×</button>}
                  {showSkuDrop&&skuOptions.length>0&&(
                    <div style={{position:'absolute',top:'100%',left:0,right:0,background:'#fff',border:'1px solid #e5e7eb',borderRadius:'8px',boxShadow:'0 8px 24px rgba(0,0,0,0.1)',zIndex:100,maxHeight:'200px',overflowY:'auto' as const,marginTop:'2px'}}>
                      {skuOptions.map((s:any)=>(
                        <div key={s.sku} onClick={()=>{setSelectedSku(s);setSkuInput('');setShowSkuDrop(false)}}
                          style={{padding:'10px 14px',cursor:'pointer',borderBottom:'1px solid #f3f4f6'}}
                          onMouseEnter={e=>(e.currentTarget.style.background='#f9fafb')} onMouseLeave={e=>(e.currentTarget.style.background='')}>
                          <div style={{fontSize:'13px',fontWeight:600,color:'#111827'}}>{s.sku}</div>
                          <div style={{fontSize:'11px',color:'#6b7280'}}>{s.productName}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>{lbl('数量')}<input type="number" value={skuQty} onChange={e=>setSkuQty(e.target.value)} min="1" style={I}/></div>
            </div>
            <div style={{marginBottom:'12px'}}>{lbl('Contenido / 内容物')}<input value={pkgContent} onChange={e=>setPkgContent(e.target.value)} placeholder="Ej: Zapatos" style={I}/></div>
            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'10px'}}>
              <div>{lbl('Largo (cm)')}<input type="number" value={pkgLength} onChange={e=>setPkgLength(e.target.value)} placeholder="0" style={I}/></div>
              <div>{lbl('Ancho (cm)')}<input type="number" value={pkgWidth} onChange={e=>setPkgWidth(e.target.value)} placeholder="0" style={I}/></div>
              <div>{lbl('Alto (cm)')}<input type="number" value={pkgHeight} onChange={e=>setPkgHeight(e.target.value)} placeholder="0" style={I}/></div>
              <div>{lbl('Peso (kg)',true)}<input type="number" value={pkgWeight} onChange={e=>setPkgWeight(e.target.value)} placeholder="0.5" step="0.01" style={I}/></div>
            </div>
          </div>
        </div>

        {result&&<div style={{padding:'14px 18px',borderRadius:'10px',marginBottom:'14px',background:result.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${result.ok?'#86efac':'#fca5a5'}`,color:result.ok?'#166534':'#991b1b',fontSize:'14px',fontWeight:500}}>{result.msg}</div>}
        <button onClick={submit} disabled={submitting} style={{width:'100%',padding:'14px',borderRadius:'10px',border:'none',background:submitting?'#e5e7eb':'#2563eb',color:submitting?'#9ca3af':'white',fontSize:'15px',fontWeight:700,cursor:submitting?'not-allowed':'pointer',boxShadow:submitting?'none':'0 4px 14px rgba(37,99,235,0.3)'}}>
          {submitting?'⟳ Creando... / 创建中...':'✓ Crear envío / 创建出库单'}
        </button>
      </div>
    </div>
  )
}
