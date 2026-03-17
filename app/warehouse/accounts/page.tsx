'use client'
import { useState, useEffect } from 'react'

interface Account { id:string; display_name:string; email:string; customer_code:string; role:string; is_active:boolean; created_at:string; oms_clients?:{customer_name:string} }
interface Client { customer_code:string; customer_name:string }

export default function AccountsPage() {
  const [accounts,  setAccounts]  = useState<Account[]>([])
  const [clients,   setClients]   = useState<Client[]>([])
  const [loading,   setLoading]   = useState(true)
  const [showForm,  setShowForm]  = useState(false)
  const [form,      setForm]      = useState({display_name:'',email:'',password:'',customer_code:'',role:'client_operator'})
  const [saving,    setSaving]    = useState(false)
  const [deleting,  setDeleting]  = useState<string|null>(null)
  const [msg,       setMsg]       = useState<{text:string;ok:boolean}|null>(null)

  const load = async() => {
    setLoading(true)
    const [ar, cr] = await Promise.all([fetch('/api/client-accounts'), fetch('/api/oms-clients')])
    const [ad, cd] = await Promise.all([ar.json(), cr.json()])
    setAccounts(ad.accounts ?? [])
    setClients((cd.clients ?? []).filter((c:Client & {auth_status:number})=>c.auth_status===1))
    setLoading(false)
  }

  const create = async() => {
    if(!form.display_name||!form.email||!form.password||!form.customer_code) {
      setMsg({text:'所有字段必填',ok:false}); return
    }
    setSaving(true)
    const r = await fetch('/api/client-accounts',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(form)})
    const d = await r.json()
    setMsg({text:d.error?`❌ ${d.error}`:'✅ 账号创建成功',ok:!d.error})
    if(!d.error){ setShowForm(false); setForm({display_name:'',email:'',password:'',customer_code:'',role:'client_operator'}); await load() }
    setSaving(false)
  }

  const toggle = async(acc:Account) => {
    await fetch('/api/client-accounts',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:acc.id,is_active:!acc.is_active})})
    await load()
  }

  const del = async(acc:Account) => {
    if(!confirm(`确认删除账号 ${acc.email}？`)) return
    setDeleting(acc.id)
    await fetch(`/api/client-accounts?id=${acc.id}`,{method:'DELETE'})
    await load(); setDeleting(null)
  }

  useEffect(()=>{ load() },[])

  const inp:React.CSSProperties={width:'100%',padding:'9px 12px',borderRadius:'7px',background:'#f8fafc',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'13px',outline:'none',boxSizing:'border-box' as const}
  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}
  const lbl=(t:string)=><label style={{fontSize:'11px',fontWeight:600,color:'#475569',display:'block',marginBottom:'4px'}}>{t}</label>

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',marginBottom:'20px'}}>
        <div>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>客户账号管理</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>管理各客户的系统登录账号，每个账号只能访问对应客户数据</p>
        </div>
        <button onClick={()=>setShowForm(s=>!s)} style={{padding:'9px 16px',borderRadius:'8px',background:'#2563eb',border:'none',color:'white',fontWeight:600,fontSize:'13px',cursor:'pointer'}}>+ 新增客户账号</button>
      </div>

      {msg&&<div style={{marginBottom:'14px',padding:'10px 14px',borderRadius:'8px',background:msg.ok?'#f0fdf4':'#fef2f2',border:`1px solid ${msg.ok?'#bbf7d0':'#fecaca'}`,color:msg.ok?'#16a34a':'#dc2626',fontSize:'13px'}}>{msg.text}</div>}

      {showForm&&(
        <div style={{...card,padding:'20px',marginBottom:'16px',border:'1px solid #bfdbfe',background:'#f8fbff'}}>
          <div style={{fontSize:'13px',fontWeight:600,color:'#0f172a',marginBottom:'14px'}}>新增客户登录账号</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'12px'}}>
            <div>{lbl('显示名称 *')}<input value={form.display_name} onChange={e=>setForm(f=>({...f,display_name:e.target.value}))} placeholder="客户联系人姓名" style={inp}/></div>
            <div>{lbl('登录邮箱 *')}<input type="email" value={form.email} onChange={e=>setForm(f=>({...f,email:e.target.value}))} placeholder="login@example.com" style={inp}/></div>
            <div>{lbl('初始密码 *')}<input type="password" value={form.password} onChange={e=>setForm(f=>({...f,password:e.target.value}))} placeholder="8位以上" style={inp}/></div>
            <div>{lbl('绑定客户 *')}
              <select value={form.customer_code} onChange={e=>setForm(f=>({...f,customer_code:e.target.value}))} style={{...inp,cursor:'pointer'}}>
                <option value="">选择客户...</option>
                {clients.map(c=><option key={c.customer_code} value={c.customer_code}>{c.customer_name} ({c.customer_code})</option>)}
              </select>
            </div>
          </div>
          <div style={{background:'#fffbeb',border:'1px solid #fde68a',borderRadius:'7px',padding:'10px 12px',marginBottom:'12px',fontSize:'12px',color:'#92400e'}}>
            ⚠️ 该账号登录后只能看到客户 <strong>{form.customer_code||'[未选择]'}</strong> 的数据，无法访问其他客户信息
          </div>
          <div style={{display:'flex',gap:'8px'}}>
            <button onClick={create} disabled={saving} style={{padding:'8px 18px',borderRadius:'7px',background:saving?'#e2e8f0':'#2563eb',border:'none',color:saving?'#94a3b8':'white',fontWeight:600,fontSize:'13px',cursor:saving?'not-allowed':'pointer'}}>{saving?'创建中...':'✓ 创建账号'}</button>
            <button onClick={()=>setShowForm(false)} style={{padding:'8px 14px',borderRadius:'7px',border:'1px solid #e2e8f0',background:'white',color:'#475569',cursor:'pointer',fontSize:'13px'}}>取消</button>
          </div>
        </div>
      )}

      <div style={{...card,overflow:'hidden'}}>
        <table style={{width:'100%',borderCollapse:'collapse' as const,fontSize:'13px'}}>
          <thead><tr style={{background:'#f8fafc',borderBottom:'1px solid #e2e8f0'}}>
            {['账号名称','邮箱','绑定客户','角色','状态','创建时间','操作'].map(h=>(
              <th key={h} style={{padding:'10px 16px',color:'#64748b',fontWeight:600,textAlign:'left' as const,fontSize:'11px'}}>{h}</th>
            ))}
          </tr></thead>
          <tbody>
            {loading ? <tr><td colSpan={7} style={{padding:'40px',textAlign:'center' as const,color:'#94a3b8'}}>加载中...</td></tr>
            : accounts.length===0 ? <tr><td colSpan={7} style={{padding:'40px',textAlign:'center' as const,color:'#94a3b8'}}>暂无客户账号，点击「新增客户账号」创建</td></tr>
            : accounts.map((acc,i)=>(
              <tr key={acc.id} style={{borderBottom:i<accounts.length-1?'1px solid #f8fafc':'none'}}>
                <td style={{padding:'12px 16px',fontWeight:600,color:'#0f172a'}}>{acc.display_name}</td>
                <td style={{padding:'12px 16px',color:'#64748b'}}>{acc.email}</td>
                <td style={{padding:'12px 16px'}}>
                  <span style={{padding:'2px 8px',borderRadius:'4px',background:'#eff6ff',color:'#2563eb',fontSize:'11px',fontWeight:600}}>{acc.customer_code}</span>
                  <span style={{marginLeft:'6px',fontSize:'11px',color:'#94a3b8'}}>{acc.oms_clients?.customer_name}</span>
                </td>
                <td style={{padding:'12px 16px',color:'#64748b',fontSize:'12px'}}>{acc.role}</td>
                <td style={{padding:'12px 16px'}}>
                  <span style={{padding:'2px 8px',borderRadius:'20px',fontSize:'11px',fontWeight:600,background:acc.is_active?'#dcfce7':'#f1f5f9',color:acc.is_active?'#16a34a':'#94a3b8'}}>{acc.is_active?'启用':'停用'}</span>
                </td>
                <td style={{padding:'12px 16px',color:'#94a3b8',fontSize:'12px'}}>{new Date(acc.created_at).toLocaleDateString('zh-CN')}</td>
                <td style={{padding:'12px 16px'}}>
                  <div style={{display:'flex',gap:'6px'}}>
                    <button onClick={()=>toggle(acc)} style={{padding:'4px 10px',borderRadius:'5px',border:'1px solid #e2e8f0',background:'#f8fafc',color:'#475569',cursor:'pointer',fontSize:'11px'}}>
                      {acc.is_active?'停用':'启用'}
                    </button>
                    <button onClick={()=>del(acc)} disabled={deleting===acc.id} style={{padding:'4px 10px',borderRadius:'5px',border:'1px solid #fecaca',background:'#fef2f2',color:'#dc2626',cursor:'pointer',fontSize:'11px'}}>
                      删除
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
