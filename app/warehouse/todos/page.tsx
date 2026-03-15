'use client'
import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { Suspense } from 'react'

interface Todo { id:string;title:string;category:string;priority:number;status:number;due_date:string|null;description:string|null;assigned_to:string|null;customer_code:string|null;lingxing_order_no:string|null;source:string;created_at:string }
interface Staff { id:string;display_name:string;email:string;role:string }
interface Client { customer_code:string;customer_name:string }
interface Comment { id:string;content_original:string;content_zh:string|null;content_es:string|null;original_lang:string;created_at:string;author?:{display_name:string} }

const SL = ['待处理','进行中','已完成','已取消']
const SC = ['#f97316','#3b82f6','#22c55e','#64748b']
const PL = ['','紧急','高','中','低']
const PC = ['','#ef4444','#f97316','#3b82f6','#64748b']

function WarehouseTodosContent() {
  const searchParams = useSearchParams()
  const [todos,      setTodos]      = useState<Todo[]>([])
  const [staff,      setStaff]      = useState<Staff[]>([])
  const [clients,    setClients]    = useState<Client[]>([])
  const [selected,   setSelected]   = useState<Todo|null>(null)
  const [comments,   setComments]   = useState<Comment[]>([])
  const [newComment, setNewComment] = useState('')
  const [translating,setTranslating]= useState(false)
  const [loading,    setLoading]    = useState(true)
  const [statusFilter,  setStatusFilter]  = useState('')
  const [clientFilter,  setClientFilter]  = useState(searchParams.get('client')||'')
  const [search,        setSearch]        = useState('')

  const load = useCallback(async () => {
    setLoading(true)
    const p = new URLSearchParams({pageSize:'500'})
    if(statusFilter) p.set('status', statusFilter)
    if(clientFilter) p.set('customerCode', clientFilter)
    if(search)       p.set('search', search)
    const [tr,sr,cr] = await Promise.all([
      fetch(`/api/todos?${p}`), fetch('/api/users'), fetch('/api/oms-clients')
    ])
    const [td,sd,cd] = await Promise.all([tr.json(),sr.json(),cr.json()])
    setTodos(td.todos??[]); setStaff(sd.users??[]); setClients(cd.clients??[])
    setLoading(false)
  },[statusFilter,clientFilter,search])

  const loadComments = async(id:string)=>{
    const r=await fetch(`/api/comments?todoId=${id}`); const d=await r.json(); setComments(d.comments??[])
  }

  const postComment = async()=>{
    if(!selected||!newComment.trim()) return
    setTranslating(true)
    const r=await fetch('/api/comments',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({todo_id:selected.id,content:newComment.trim(),author_name:'仓库管理员'})})
    const d=await r.json()
    if(d.error){ alert(d.error) }
    else { setNewComment(''); await loadComments(selected.id) }
    setTranslating(false)
  }

  const assignTodo=async(todoId:string,userId:string)=>{
    await fetch('/api/todos',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:todoId,assigned_to:userId||null,assigned_at:userId?new Date().toISOString():null})})
    await load()
    if(selected?.id===todoId) setSelected(s=>s?{...s,assigned_to:userId||null}:s)
  }

  const updateStatus=async(id:string,status:number)=>{
    await fetch('/api/todos',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id,status})})
    setSelected(s=>s?.id===id?{...s,status}:s); await load()
  }

  useEffect(()=>{load()},[load])

  const clientName=(code:string|null)=>clients.find(c=>c.customer_code===code)?.customer_name??code??'-'
  const inp:React.CSSProperties={padding:'7px 10px',borderRadius:'6px',background:'#ffffff',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'12px',cursor:'pointer',outline:'none'}

  return (
    <div style={{flex:1,display:'flex',overflow:'hidden',background:'#f8fafc'}}>
      {/* Left panel */}
      <div style={{width:'380px',flexShrink:0,borderRight:'1px solid #e2e8f0',display:'flex',flexDirection:'column'}}>
        <div style={{padding:'14px',borderBottom:'1px solid #e2e8f0',display:'flex',flexDirection:'column' as const,gap:'8px'}}>
          <div style={{fontSize:'14px',fontWeight:800,color:'#0f172a'}}>全部待办 · {todos.length}条</div>
          <input value={search} onChange={e=>setSearch(e.target.value)} onKeyDown={e=>e.key==='Enter'&&load()} placeholder="搜索待办标题..." style={{...inp,width:'100%',boxSizing:'border-box' as const}}/>
          <div style={{display:'flex',gap:'6px'}}>
            <select value={statusFilter} onChange={e=>setStatusFilter(e.target.value)} style={{...inp,flex:1}}>
              <option value="">全部状态</option>
              {SL.map((l,i)=><option key={i} value={i}>{l}</option>)}
            </select>
            <select value={clientFilter} onChange={e=>setClientFilter(e.target.value)} style={{...inp,flex:1}}>
              <option value="">全部客户</option>
              {clients.map(c=><option key={c.customer_code} value={c.customer_code}>{c.customer_name}</option>)}
            </select>
          </div>
        </div>
        <div style={{flex:1,overflowY:'auto' as const}}>
          {loading?<div style={{padding:'20px',textAlign:'center' as const,color:'#6b7280',fontSize:'13px'}}>加载中...</div>
          :todos.length===0?<div style={{padding:'20px',textAlign:'center' as const,color:'#6b7280',fontSize:'13px'}}>暂无待办</div>
          :todos.map(t=>{
            const assignee=staff.find(s=>s.id===t.assigned_to)
            return (
              <div key={t.id} onClick={()=>{setSelected(t);loadComments(t.id)}} style={{padding:'11px 14px',borderBottom:'1px solid #f1f5f9',cursor:'pointer',background:selected?.id===t.id?'#f1f5f9':'transparent'}}>
                <div style={{display:'flex',alignItems:'flex-start',justifyContent:'space-between',gap:'6px',marginBottom:'4px'}}>
                  <span style={{fontSize:'12px',color:'#0f172a',flex:1,overflow:'hidden',textOverflow:'ellipsis',whiteSpace:'nowrap' as const,fontWeight:selected?.id===t.id?700:400}}>{t.title}</span>
                  <span style={{padding:'1px 5px',borderRadius:'3px',fontSize:'10px',fontWeight:700,background:`${SC[t.status]}22`,color:SC[t.status],flexShrink:0}}>{SL[t.status]}</span>
                </div>
                <div style={{display:'flex',gap:'5px',fontSize:'11px',color:'#6b7280',flexWrap:'wrap' as const}}>
                  {t.customer_code&&<span style={{color:'#a855f7',fontWeight:600}}>{clientName(t.customer_code)}</span>}
                  <span>·</span><span>{t.category}</span>
                  {assignee&&<><span>·</span><span style={{color:'#22c55e'}}>👤{assignee.display_name}</span></>}
                  {t.due_date&&<><span>·</span><span style={{color:new Date(t.due_date)<new Date()&&t.status!==2?'#ef4444':'#64748b'}}>{t.due_date}</span></>}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Right panel */}
      {selected?(
        <div style={{flex:1,display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'18px 24px',borderBottom:'1px solid #e2e8f0',background:'#ffffff'}}>
            <div style={{display:'flex',alignItems:'flex-start',gap:'10px',marginBottom:'8px'}}>
              <div style={{flex:1}}>
                <h2 style={{fontSize:'15px',fontWeight:800,color:'#0f172a',marginBottom:'6px'}}>{selected.title}</h2>
                <div style={{display:'flex',gap:'5px',flexWrap:'wrap' as const}}>
                  <span style={{padding:'2px 7px',borderRadius:'4px',fontSize:'11px',background:`${SC[selected.status]}22`,color:SC[selected.status],fontWeight:700}}>{SL[selected.status]}</span>
                  <span style={{padding:'2px 7px',borderRadius:'4px',fontSize:'11px',background:'#f1f5f9',color:'#64748b'}}>{selected.category}</span>
                  {selected.customer_code&&<span style={{padding:'2px 7px',borderRadius:'4px',fontSize:'11px',background:'#a855f722',color:'#a855f7',fontWeight:600}}>{clientName(selected.customer_code)}</span>}
                  {selected.source==='lingxing_auto'&&<span style={{padding:'2px 7px',borderRadius:'4px',fontSize:'11px',background:'#eff6ff',color:'#3b82f6'}}>领星同步</span>}
                </div>
              </div>
            </div>
            {selected.description&&<p style={{fontSize:'12px',color:'#64748b',lineHeight:1.7}}>{selected.description}</p>}
          </div>

          <div style={{padding:'14px 24px',borderBottom:'1px solid #e2e8f0',display:'flex',gap:'20px',alignItems:'flex-start',flexWrap:'wrap' as const}}>
            <div>
              <div style={{fontSize:'10px',color:'#64748b',marginBottom:'5px',fontWeight:600}}>状态</div>
              <div style={{display:'flex',gap:'4px'}}>
                {SL.map((l,i)=><button key={i} onClick={()=>updateStatus(selected.id,i)} style={{padding:'5px 9px',borderRadius:'5px',border:'none',background:selected.status===i?`${SC[i]}33`:'#f1f5f9',color:selected.status===i?SC[i]:'#64748b',cursor:'pointer',fontSize:'11px',fontWeight:selected.status===i?700:400}}>{l}</button>)}
              </div>
            </div>
            <div>
              <div style={{fontSize:'10px',color:'#64748b',marginBottom:'5px',fontWeight:600}}>指派给员工</div>
              <select value={selected.assigned_to??''} onChange={e=>assignTodo(selected.id,e.target.value)} style={{padding:'6px 10px',borderRadius:'6px',background:'#f1f5f9',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'12px',cursor:'pointer'}}>
                <option value="">未指派</option>
                {staff.map(s=><option key={s.id} value={s.id}>{s.display_name}</option>)}
              </select>
            </div>
          </div>

          <div style={{flex:1,overflowY:'auto' as const,padding:'14px 24px'}}>
            <div style={{fontSize:'13px',fontWeight:700,color:'#0f172a',marginBottom:'10px'}}>💬 留言反馈（中西双语）</div>
            {comments.length===0?<div style={{color:'#6b7280',fontSize:'12px',marginBottom:'12px'}}>暂无留言</div>
            :comments.map(c=>(
              <div key={c.id} style={{marginBottom:'10px',padding:'12px',background:'#ffffff',borderRadius:'8px',border:'1px solid #e2e8f0'}}>
                <div style={{fontSize:'11px',color:'#64748b',marginBottom:'5px'}}>
                  {c.author_name??'用户'} · {new Date(c.created_at).toLocaleString('zh-CN')}
                  <span style={{marginLeft:'6px',padding:'1px 5px',borderRadius:'3px',background:'#e2e8f0',color:'#64748b',fontSize:'10px'}}>{c.original_lang==='zh'?'🇨🇳中文':'🇲🇽Español'}</span>
                </div>
                {c.content_zh&&<div style={{fontSize:'13px',color:'#0f172a',marginBottom:c.content_es?'5px':0}}>🇨🇳 {c.content_zh}</div>}
                {c.content_es&&<div style={{fontSize:'13px',color:'#64748b'}}>🇲🇽 {c.content_es}</div>}
              </div>
            ))}
          </div>
          <div style={{padding:'12px 24px',borderTop:'1px solid #e2e8f0',background:'#ffffff'}}>
            <div style={{display:'flex',gap:'8px',alignItems:'flex-end'}}>
              <textarea value={newComment} onChange={e=>setNewComment(e.target.value)} placeholder="添加留言（中文/Español）→ 自动双语翻译" rows={2} style={{flex:1,padding:'9px 12px',borderRadius:'8px',background:'#f8fafc',border:'1px solid #e2e8f0',color:'#0f172a',fontSize:'13px',resize:'none' as const,outline:'none'}}/>
              <button onClick={postComment} disabled={translating||!newComment.trim()} style={{padding:'9px 14px',borderRadius:'8px',background:translating?'#1e3a5f':'#3b82f6',border:'none',color:'white',fontWeight:700,fontSize:'13px',cursor:translating?'not-allowed':'pointer',flexShrink:0}}>{translating?'翻译中...':'发送'}</button>
            </div>
          </div>
        </div>
      ):(
        <div style={{flex:1,display:'flex',alignItems:'center',justifyContent:'center',color:'#6b7280'}}>
          <div style={{textAlign:'center' as const}}>
            <div style={{fontSize:'36px',marginBottom:'12px',opacity:0.4}}>📋</div>
            <div style={{fontSize:'13px'}}>选择左侧待办查看详情、指派员工、添加留言</div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function WarehouseTodosPage() {
  return <Suspense fallback={<div style={{padding:'40px',textAlign:'center' as const,color:'#6b7280'}}>加载中...</div>}><WarehouseTodosContent/></Suspense>
}
