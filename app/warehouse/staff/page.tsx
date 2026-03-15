'use client'
import { useState, useEffect } from 'react'

interface Staff { id:string; display_name:string; email:string; role:string; language:string; is_active:boolean; created_at:string }

const ROLES: Record<string,string> = {
  warehouse_admin:  '仓库管理员',
  warehouse_staff:  '仓库员工',
  client_admin:     '客户管理员',
  client_operator:  '客户操作员',
}

export default function StaffPage() {
  const [staff, setStaff] = useState<Staff[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({display_name:'',email:'',password:'',role:'warehouse_staff',language:'zh'})
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')

  const load = async () => {
    setLoading(true)
    const r = await fetch('/api/users'); const d = await r.json()
    setStaff(d.users ?? []); setLoading(false)
  }

  const createStaff = async () => {
    if(!form.display_name||!form.email||!form.password){ setMsg('❌ 请填写完整信息'); return }
    setSaving(true); setMsg('')
    const r = await fetch('/api/users', {method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const d = await r.json()
    if(d.error){ setMsg(`❌ ${d.error}`) } else { setMsg('✅ 创建成功'); setShowForm(false); setForm({display_name:'',email:'',password:'',role:'warehouse_staff',language:'zh'}); await load() }
    setSaving(false)
  }

  useEffect(()=>{load()},[])

  const inp: React.CSSProperties = {width:'100%',padding:'9px 12px',borderRadius:'7px',background:'#0f1117',border:'1px solid #2a3250',color:'#e2e8f0',fontSize:'13px',outline:'none',boxSizing:'border-box'}
  const sel: React.CSSProperties = {...inp,cursor:'pointer'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#0d1117',padding:'28px 24px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'24px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:800,color:'#f1f5f9'}}>员工管理</h1>
          <p style={{fontSize:'12px',color:'#475569',marginTop:'4px'}}>管理仓库和客户员工账号及权限</p>
        </div>
        <button onClick={()=>setShowForm(s=>!s)} style={{padding:'8px 18px',borderRadius:'7px',background:'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:'pointer'}}>
          + 新建员工
        </button>
      </div>

      {msg && <div style={{marginBottom:'16px',padding:'10px 14px',borderRadius:'8px',background:msg.includes('❌')?'#ef444415':'#22c55e15',border:`1px solid ${msg.includes('❌')?'#ef444433':'#22c55e33'}`,color:msg.includes('❌')?'#ef4444':'#22c55e',fontSize:'13px'}}>{msg}</div>}

      {showForm && (
        <div style={{background:'#161b26',border:'1px solid #3b82f644',borderRadius:'12px',padding:'20px',marginBottom:'20px'}}>
          <div style={{fontSize:'14px',fontWeight:700,color:'#f1f5f9',marginBottom:'16px'}}>新建员工账号</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'12px',marginBottom:'12px'}}>
            <div><label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'5px'}}>姓名 *</label><input value={form.display_name} onChange={e=>setForm(f=>({...f,display_name:e.target.value}))} placeholder="员工姓名" style={inp}/></div>
            <div><label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'5px'}}>邮箱 *</label><input value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="登录邮箱" style={inp}/></div>
            <div><label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'5px'}}>密码 *</label><input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="初始密码" style={inp}/></div>
            <div><label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'5px'}}>角色</label>
              <select value={form.role} onChange={e=>setForm(f=>({...f,role:e.target.value}))} style={sel}>
                {Object.entries(ROLES).map(([k,v])=><option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <div><label style={{fontSize:'11px',color:'#94a3b8',display:'block',marginBottom:'5px'}}>界面语言</label>
              <select value={form.language} onChange={e=>setForm(f=>({...f,language:e.target.value}))} style={sel}>
                <option value="zh">中文</option>
                <option value="es">Español</option>
              </select>
            </div>
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={createStaff} disabled={saving} style={{padding:'9px 20px',borderRadius:'7px',background:'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:saving?'not-allowed':'pointer'}}>{saving?'创建中...':'✅ 确认创建'}</button>
            <button onClick={()=>setShowForm(false)} style={{padding:'9px 16px',borderRadius:'7px',border:'1px solid #2a3250',background:'transparent',color:'#64748b',cursor:'pointer',fontSize:'13px'}}>取消</button>
          </div>
        </div>
      )}

      <div style={{background:'#161b26',border:'1px solid #2a3250',borderRadius:'12px',overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
          <thead>
            <tr style={{background:'#0a0d14',borderBottom:'1px solid #2a3250'}}>
              {['姓名','邮箱','角色','语言','状态','创建时间'].map(h=>(
                <th key={h} style={{padding:'12px 16px',color:'#64748b',fontWeight:700,textAlign:'left' as const}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading ? <tr><td colSpan={6} style={{padding:'40px',textAlign:'center' as const,color:'#475569'}}>加载中...</td></tr>
            : staff.length===0 ? <tr><td colSpan={6} style={{padding:'40px',textAlign:'center' as const,color:'#475569'}}>暂无员工账号，点击「新建员工」添加</td></tr>
            : staff.map((s,i)=>(
              <tr key={s.id} style={{borderBottom:'1px solid #1a2035',background:i%2===0?'transparent':'#0d1117'}}>
                <td style={{padding:'12px 16px',color:'#f1f5f9',fontWeight:600}}>{s.display_name}</td>
                <td style={{padding:'12px 16px',color:'#94a3b8'}}>{s.email}</td>
                <td style={{padding:'12px 16px'}}><span style={{padding:'2px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:600,background:'#3b82f622',color:'#3b82f6'}}>{ROLES[s.role]??s.role}</span></td>
                <td style={{padding:'12px 16px',color:'#94a3b8'}}>{s.language==='zh'?'中文':'Español'}</td>
                <td style={{padding:'12px 16px'}}><span style={{padding:'2px 8px',borderRadius:'4px',fontSize:'11px',fontWeight:600,background:s.is_active?'#22c55e22':'#ef444422',color:s.is_active?'#22c55e':'#ef4444'}}>{s.is_active?'启用':'停用'}</span></td>
                <td style={{padding:'12px 16px',color:'#475569',fontSize:'12px'}}>{new Date(s.created_at).toLocaleDateString('zh-CN')}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
