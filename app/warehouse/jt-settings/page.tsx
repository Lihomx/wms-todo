'use client'
import { useState, useEffect } from 'react'


function getWmsHeaders(): Record<string, string> {
  const h: Record<string, string> = { "Content-Type": "application/json" }
  if (typeof window === "undefined") return h
  if (sessionStorage.getItem("wms_warehouse_role") === "admin") { h["x-wms-role"] = "admin"; return h }
  try {
    const s = sessionStorage.getItem("wms_client_session")
    if (s) { const p = JSON.parse(s); if (p?.customerCode) { h["x-wms-role"] = "client"; h["x-customer-code"] = p.customerCode; return h } }
  } catch {}
  return h
}
function api(action: string, body: object = {}): Promise<any> {
  return fetch(`/api/jt?action=${action}`, { method: "POST", headers: getWmsHeaders(), body: JSON.stringify(body) })
    .then(r => r.json()).then(d => { if (!d.success) throw new Error(d.msg || "请求失败"); return d.data })
}


const inp:React.CSSProperties={width:'100%',padding:'10px 12px',border:'1.5px solid #dde3f5',borderRadius:'6px',fontSize:'14px',outline:'none',fontFamily:'inherit',background:'#fff',boxSizing:'border-box' as const}
const lbl=(t:string)=><label style={{display:'block',fontSize:'12px',fontWeight:600,color:'#6b6560',textTransform:'uppercase' as const,letterSpacing:'0.5px',marginBottom:'6px'}}>{t}</label>

export default function JTAdminSettings() {
  const [cfg,     setCfg]     = useState<any>({})
  const [shipper, setShipper] = useState<any>({})
  const [loading, setLoading] = useState(true)
  const [saving,  setSaving]  = useState(false)
  const [testing, setTesting] = useState(false)
  const [testResult, setTestResult] = useState<any>(null)
  const [msg,     setMsg]     = useState<{text:string;ok:boolean}|null>(null)

  useEffect(()=>{
    api('get_config').then(d=>{ setCfg(d); setShipper(d.shipper||{}) }).finally(()=>setLoading(false))
  },[])

  const save = async() => {
    setSaving(true); setMsg(null)
    try {
      await api('save_config', { ...cfg, shipper })
      setMsg({text:'✅ Configuración guardada / 配置已保存', ok:true})
    } catch(e:any) { setMsg({text:'❌ '+e.message, ok:false}) }
    setSaving(false)
  }

  const testConn = async() => {
    setTesting(true); setTestResult(null); setMsg(null)
    try {
      const d = await api('test_connection', { appToken: cfg.appToken, appKey: cfg.appKey, apiUrl: cfg.apiUrl })
      setTestResult(d)
      setMsg({ text: d.success==1 ? `✅ 连接成功！找到 ${(d.data||[]).length} 种物流方式` : `❌ ${d.cnmessage||d.enmessage||'连接失败'}`, ok: d.success==1 })
    } catch(e:any) { setMsg({text:'❌ '+e.message, ok:false}) }
    setTesting(false)
  }

  if (loading) return <div style={{color:'#6b6560',padding:'40px',textAlign:'center' as const}}>Cargando...</div>

  const card:React.CSSProperties={background:'#fff',border:'1px solid #dde3f5',borderRadius:'10px',padding:'20px',marginBottom:'16px'}

  return (
    <div style={{maxWidth:'700px'}}>
      <div style={{marginBottom:'20px'}}>
        <h1 style={{fontSize:'20px',fontWeight:700}}>Configuración / 系统设置</h1>
        <p style={{fontSize:'13px',color:'#6b6560',marginTop:'3px'}}>API极兔 · 发件地址 · 管理员密码</p>
      </div>

      {msg && <div style={{padding:'12px 16px',borderRadius:'6px',background:msg.ok?'#e8f8ef':'#fde8e8',border:`1px solid ${msg.ok?'#b4e8cb':'#f4b4b4'}`,color:msg.ok?'#2a9d5c':'#d63030',fontSize:'13px',marginBottom:'14px'}}>{msg.text}</div>}

      {/* API Config */}
      <div style={card}>
        <div style={{fontSize:'15px',fontWeight:700,marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px'}}>🔌 Configuración API J&T</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'14px',marginBottom:'14px'}}>
          <div>{lbl('App Token')}<input value={cfg.appToken||''} onChange={e=>setCfg({...cfg,appToken:e.target.value})} placeholder="appToken de J&T" style={inp}/></div>
          <div>{lbl('App Key')}<input value={cfg.appKey||''} onChange={e=>setCfg({...cfg,appKey:e.target.value})} placeholder="appKey de J&T (enmascarado)" style={inp}/></div>
          <div>{lbl('Método de envío')}<input value={cfg.shippingMethod||''} onChange={e=>setCfg({...cfg,shippingMethod:e.target.value})} placeholder="JT-MX-CD-N" style={inp}/></div>
          <div>{lbl('API URL')}<input value={cfg.apiUrl||''} onChange={e=>setCfg({...cfg,apiUrl:e.target.value})} style={inp}/></div>
        </div>
        <div style={{display:'flex',gap:'10px'}}>
          <button onClick={testConn} disabled={testing} style={{padding:'9px 18px',borderRadius:'6px',background:testing?'#e0ede8':'#2a9d5c',color:'#fff',border:'none',cursor:testing?'not-allowed':'pointer',fontWeight:600,fontSize:'13px',fontFamily:'inherit'}}>
            {testing ? '⟳ Probando...' : '🔗 Probar conexión / 测试连接'}
          </button>
        </div>
        {testResult && testResult.success==1 && (
          <div style={{marginTop:'12px',padding:'10px',background:'#f0f4ff',borderRadius:'6px',fontSize:'12px',color:'#2a4480'}}>
            <strong>Métodos disponibles:</strong><br/>
            {(testResult.data||[]).map((m:any)=><span key={m.shipping_method_code} style={{display:'inline-block',margin:'3px',padding:'2px 8px',background:'#eef2ff',borderRadius:'4px'}}>{m.shipping_method_code}</span>)}
          </div>
        )}
      </div>

      {/* Shipper address */}
      <div style={card}>
        <div style={{fontSize:'15px',fontWeight:700,marginBottom:'16px',display:'flex',alignItems:'center',gap:'8px'}}>🏭 Dirección de origen / 发件地址（固定）</div>
        <p style={{fontSize:'12px',color:'#6b6560',marginBottom:'14px'}}>Esta dirección aparece automáticamente en todos los envíos. No puede ser modificada por el cliente.</p>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
          <div>{lbl('Nombre / 联系人')}<input value={shipper.name||''} onChange={e=>setShipper({...shipper,name:e.target.value})} placeholder="ZHENYUAN LI" style={inp}/></div>
          <div>{lbl('Empresa / 公司')}<input value={shipper.company||''} onChange={e=>setShipper({...shipper,company:e.target.value})} placeholder="LIHO-CHIU" style={inp}/></div>
          <div>{lbl('Teléfono / 电话')}<input value={shipper.telephone||''} onChange={e=>setShipper({...shipper,telephone:e.target.value})} placeholder="5514296243" style={inp}/></div>
          <div>{lbl('CP / 邮编')}<input value={shipper.postcode||''} onChange={e=>setShipper({...shipper,postcode:e.target.value})} placeholder="54743" style={inp}/></div>
          <div style={{gridColumn:'1/-1'}}>{lbl('Calle y número / 地址')}<input value={shipper.street||''} onChange={e=>setShipper({...shipper,street:e.target.value})} placeholder="TORRE DEL CAMPO Manzana 294" style={inp}/></div>
          <div>{lbl('Ciudad / 城市')}<input value={shipper.city||''} onChange={e=>setShipper({...shipper,city:e.target.value})} placeholder="Cuautitlán Izcalli" style={inp}/></div>
          <div>{lbl('Estado / 州')}<input value={shipper.province||''} onChange={e=>setShipper({...shipper,province:e.target.value})} placeholder="México" style={inp}/></div>
        </div>
      </div>

      <button onClick={save} disabled={saving} style={{padding:'12px 28px',borderRadius:'7px',background:saving?'#c0cef5':'#2a4480',color:'#fff',border:'none',cursor:saving?'not-allowed':'pointer',fontWeight:700,fontSize:'14px',fontFamily:'inherit'}}>
        {saving ? '⟳ Guardando...' : '💾 Guardar configuración / 保存设置'}
      </button>
    </div>
  )
}
