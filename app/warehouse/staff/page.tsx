'use client'
import { useState, useEffect } from 'react'

interface Staff { id:string;display_name:string;email:string;role:string;language:string;is_active:boolean;created_at:string }
const ROLES:Record<string,string>={warehouse_admin:'仓库管理员',warehouse_staff:'仓库员工',client_admin:'客户管理员',client_operator:'客户操作员'}

export default function StaffPage() {
  const [staff,    setStaff]    = useState<Staff[]>([])
  const [loading,  setLoading]  = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form,     setForm]     = useState({display_name:'',email:'',password:'',role:'warehouse_staff',language:'zh'})
  const [saving,   setSaving]   = useState(false)
  const [msg,      setMsg]      = useState<{text:string;ok:boolean}|null>(null)

  const load=async()=>{ setLoading(true); const r=await fetch('/api/users'); const d=await r.json(); setStaff(d.users??[]); setLoading(false) }

  const create=async()=>{
    if(!form.display_name||!form.email||!form.password){ setMsg({text:'请填写完整信息',ok:false}); return }
    setSaving(true); setMsg(null)
    const r=await fetch('/api/users',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const d=await r.json()
    setMsg({text:d.error?`❌ ${d.error}`:'✅ 员工账号创建成功',ok:!d.error})
    if(!d.error){ setShowForm(false); setForm({display_name:'',email:'',password:'',role:'warehouse_staff',language:'zh'}); await load() }
    setSaving(false)
  }

  useEffect(()=>{ load() },[])

  const inp:React.CSSProperties={width:'100%',padding:'9px 12px',borderRadius:'7px',background:'#f8fafc',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}
  const sel:React.CSSProperties={...inp,cursor:'pointer'}
  const label:React.CSSProperties={fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}
  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>员工管理</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>管理仓库员工账号及操作权限</p>
        </div>
        <button onClick={()=>setShowForm(s=>!s)} style={{padding:'9px 16px',borderRadius:'8px',background:'#2563eb',border:'none',color:'white',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>+ 新建员工</button>
      </div>

      {msg && <div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:msg.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`,color:msg.ok?'#16a34a':'#dc2626',fontSize:'13px'}}>{msg.text}</div>}

      {showForm && (
        <div style={{...card,padding:'20px',marginBottom:'16px',border:'1px solid #bfdbfe',background:'#f8fbff'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'14px'}}>新建员工账号</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
            <div><label style={label}>姓名 *</label><input value={form.display_name} onChange={e=>setForm(f=>({...f,display_name:e.target.value}))} placeholder="员工姓名" style={inp}/></div>
            <div><label style={label}>邮箱 *</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="登录邮箱" style={inp}/></div>
            <div><label style={label}>密码 *</label><input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="初始密码（8位以上）" style={inp}/></div>
            <div><label style={label}>角色</label><select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={sel}>{Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}</select></div>
            <div><label style={label}>界面语言</label><select value={form.language} onChange={e=>setForm(f=>({...f,language:e.target.value}))} style={sel}><option value="zh">中文</option><option value="es">Español</option></select></div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={create} disabled={saving} style={{padding:'8px 18px',borderRadius:'7px',background:saving?'#e2e8f0':'#2563eb',border:'none',color:saving?'#94a3b8':'white',fontWeight:600,fontSize:'13px',cursor:saving?'not-allowed':'pointer'}}>{saving?'创建中...':'✓ 确认创建'}</button>
            <button onClick={()=>setShowForm(false)} style={{padding:'8px 14px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'white',color:'#475569',cursor:'pointer',fontSize:'13px'}}>取消</button>
          </div>
        </div>
      )}

      <div style={{...card,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
          <thead><tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
            {['姓名','邮箱','角色','语言','状态','创建时间'].map(h=><th key={h} style={{padding:'10px 16px',color:'#64748b',fontWeight:600,textAlign:'left' as const,fontSize:'12px'}}>{h}</th>)}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>加载中...</td></tr>
            : staff.length===0 ? <tr><td colSpan={6} style={{padding:'40px',textAlign:'center' as const,color:'#94a3b8',fontSize:'13px'}}>暂无员工账号，点击「新建员工」添加</td></tr>
            : staff.map((s,i)=>(
              <tr key={s.id} style={{borderBottom:i<staff.length-1?'1px solid #f8fafc':'none'}}>
                <td style={{padding:'12px 16px',fontWeight:600,color:'#0f172a'}}>{s.display_name}</td>
                <td style={{padding:'12px 16px',color:'#64748b'}}>{s.email}</td>
                <td style={{padding:'12px 16px'}}><span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:'#eff6ff',color:'#2563eb',border:'1px solid #bfdbfe'}}>{ROLES[s.role]??s.role}</span></td>
                <td style={{padding:'12px 16px',color:'#64748b'}}>{s.language==='zh'?'中文':'Español'}</td>
                <td style={{padding:'12px 16px'}}><span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:s.is_active?'#dcfce7':'#f1f5f9',color:s.is_active?'#16a34a':'#94a3b8'}}>{s.is_active?'启用':'停用'}</span></td>
                <td style={{padding:'12px 16px',color:'#94a3b8',fontSize:'12px'}}>{new Date(s.created_at).toLocaleDateString('zh-CN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
