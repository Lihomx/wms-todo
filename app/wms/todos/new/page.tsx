'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

const CATS = ['入库作业','出库作业','库存管理','退货处理','工单审批','其他']
const CAT_ICONS: Record<string,string> = { '入库作业':'📦','出库作业':'🚚','库存管理':'📊','退货处理':'↩️','工单审批':'📋','其他':'⚡' }
const CAT_DESC: Record<string,string> = { '入库作业':'入库预报·收货·上架', '出库作业':'一件代发·FBA备货', '库存管理':'库存预警·盘点', '退货处理':'退件处理·质检', '工单审批':'操作申请·审批', '其他':'临时任务·杂项' }

const DEFAULT_CHECKS: Record<string,string[]> = {
  '入库作业': ['确认入库单信息', '安排收货时间', '验收货物', '上架入库', '更新系统库存'],
  '出库作业': ['确认出库单信息', '核对商品SKU', '拣货打包', '贴面单', '称重发货'],
  '库存管理': ['核查当前库存', '分析滞销原因', '制定处理方案', '更新预警配置'],
  '退货处理': ['确认退件信息', '质检商品', '确认是否可二次销售', '更新库存', '反馈处理结果'],
  '工单审批': ['查看申请内容', '核实操作原因', '确认审批结果', '通知申请人'],
}

const lbl: React.CSSProperties = { display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '7px', textTransform: 'uppercase', letterSpacing: '0.5px' }
const inp: React.CSSProperties = { width: '100%', background: '#0d1117', border: '1px solid #2a3250', borderRadius: '8px', padding: '10px 13px', color: '#e2e8f0', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }

export default function NewTodoPage() {
  const router = useRouter()
  const [title,    setTitle]    = useState('')
  const [category, setCat]      = useState('入库作业')
  const [priority, setPri]      = useState(2)
  const [dueDate,  setDue]      = useState('')
  const [desc,     setDesc]     = useState('')
  const [orderNo,  setOrderNo]  = useState('')
  const [checks,   setChecks]   = useState<string[]>(DEFAULT_CHECKS['入库作业'])
  const [newCheck, setNewCheck] = useState('')
  const [saving,   setSaving]   = useState(false)
  const [error,    setError]    = useState('')

  const handleCatChange = (c: string) => {
    setCat(c)
    setChecks(DEFAULT_CHECKS[c] ?? [])
  }

  const addCheck = () => {
    if (!newCheck.trim()) return
    setChecks(cs => [...cs, newCheck.trim()])
    setNewCheck('')
  }

  const removeCheck = (i: number) => setChecks(cs => cs.filter((_,idx)=>idx!==i))

  const submit = async () => {
    if (!title.trim()) { setError('请填写待办标题'); return }
    setSaving(true); setError('')
    try {
      const res = await fetch('/api/todos', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(), category, priority,
          due_date: dueDate || null,
          description: desc.trim() || null,
          lingxing_order_no: orderNo.trim() || null,
          checklist: checks.filter(Boolean).map(c=>({ content: c })),
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error||'创建失败') }
      router.push('/wms/todos')
    } catch(e:any) { setError(e.message) }
    setSaving(false)
  }

  const priOpts = [
    { v: 1, label: '紧急', color: '#ef4444', desc: '需立即处理' },
    { v: 2, label: '普通', color: '#3b82f6', desc: '正常流程' },
    { v: 3, label: '低优', color: '#64748b', desc: '有空处理' },
  ]

  return (
    <div style={{ flex: 1, overflowY: 'auto', background: '#0d1117' }}>
      <div style={{ maxWidth: '760px', margin: '0 auto', padding: '28px 24px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '28px' }}>
          <Link href="/wms/todos" style={{ padding: '7px 12px', borderRadius: '7px', border: '1px solid #2a3250', color: '#64748b', textDecoration: 'none', fontSize: '12px' }}>← 返回</Link>
          <div>
            <h1 style={{ fontSize: '18px', fontWeight: 800, color: '#f1f5f9' }}>新建待办</h1>
            <p style={{ fontSize: '12px', color: '#475569', marginTop: '3px' }}>手工录入 · 数据保存到本地</p>
          </div>
        </div>

        {error && <div style={{ marginBottom: '16px', padding: '10px 14px', background: '#ef444415', border: '1px solid #ef444433', borderRadius: '8px', color: '#ef4444', fontSize: '13px' }}>{error}</div>}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>

          {/* Left col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            <div>
              <label style={lbl}>待办标题 *</label>
              <input value={title} onChange={e=>setTitle(e.target.value)} style={{ ...inp, fontSize: '14px' }} placeholder="简明描述要做的事情..." onKeyDown={e=>e.key==='Enter'&&submit()} />
            </div>

            <div>
              <label style={lbl}>单号（可选）</label>
              <input value={orderNo} onChange={e=>setOrderNo(e.target.value)} style={inp} placeholder="如入库单号、出库单号..." />
            </div>

            <div>
              <label style={lbl}>截止日期</label>
              <input type="date" value={dueDate} onChange={e=>setDue(e.target.value)} style={inp} />
            </div>

            <div>
              <label style={lbl}>备注说明</label>
              <textarea value={desc} onChange={e=>setDesc(e.target.value)} rows={4} style={{ ...inp, resize: 'vertical' as const }} placeholder="补充说明、注意事项..." />
            </div>
          </div>

          {/* Right col */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '18px' }}>

            {/* Category */}
            <div>
              <label style={lbl}>业务分类 *</label>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {CATS.map(c=>(
                  <div key={c} onClick={()=>handleCatChange(c)} style={{ padding: '10px 12px', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${category===c?'#3b82f6':'#2a3250'}`, background: category===c?'#1e3a5f':'#161b26', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '16px' }}>{CAT_ICONS[c]}</div>
                    <div style={{ fontSize: '12px', fontWeight: 700, color: category===c?'#93c5fd':'#94a3b8', marginTop: '4px' }}>{c}</div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>{CAT_DESC[c]}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Priority */}
            <div>
              <label style={lbl}>优先级</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {priOpts.map(p=>(
                  <div key={p.v} onClick={()=>setPri(p.v)} style={{ flex: 1, padding: '10px', borderRadius: '8px', cursor: 'pointer', border: `1px solid ${priority===p.v?p.color:p.color+'33'}`, background: priority===p.v?`${p.color}18`:'transparent', textAlign: 'center', transition: 'all 0.15s' }}>
                    <div style={{ fontSize: '13px', fontWeight: 700, color: priority===p.v?p.color:'#64748b' }}>{p.label}</div>
                    <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>{p.desc}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Checklist */}
        <div style={{ marginTop: '24px', padding: '20px', background: '#161b26', border: '1px solid #2a3250', borderRadius: '12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', marginBottom: '14px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>📋 检查清单（{checks.length} 项）</span>
            <span style={{ fontSize: '10px', color: '#334155' }}>根据分类自动生成，可修改</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', marginBottom: '10px' }}>
            {checks.map((c,i)=>(
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 10px', background: '#0d1117', border: '1px solid #2a3250', borderRadius: '7px' }}>
                <div style={{ width: '14px', height: '14px', borderRadius: '3px', border: '1px solid #2a3250', flexShrink: 0 }} />
                <span style={{ flex: 1, fontSize: '12px', color: '#94a3b8' }}>{c}</span>
                <button onClick={()=>removeCheck(i)} style={{ background: 'none', border: 'none', color: '#475569', cursor: 'pointer', fontSize: '14px', lineHeight: 1, padding: '0 4px' }}>×</button>
              </div>
            ))}
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <input value={newCheck} onChange={e=>setNewCheck(e.target.value)} onKeyDown={e=>e.key==='Enter'&&addCheck()} placeholder="新增检查项..." style={{ ...inp, flex: 1, fontSize: '12px', padding: '8px 11px' }} />
            <button onClick={addCheck} style={{ padding: '8px 14px', borderRadius: '7px', background: '#1e3a5f', border: '1px solid #3b82f644', color: '#3b82f6', cursor: 'pointer', fontSize: '12px', fontWeight: 700, flexShrink: 0 }}>+ 添加</button>
          </div>
        </div>

        {/* Submit */}
        <div style={{ display: 'flex', gap: '12px', marginTop: '24px', justifyContent: 'flex-end' }}>
          <Link href="/wms/todos" style={{ padding: '10px 22px', borderRadius: '8px', border: '1px solid #2a3250', color: '#64748b', textDecoration: 'none', fontSize: '13px' }}>取消</Link>
          <button onClick={submit} disabled={saving} style={{ padding: '10px 28px', borderRadius: '8px', background: saving?'#1e3a5f':'#3b82f6', border: 'none', color: 'white', fontWeight: 700, fontSize: '14px', cursor: saving?'not-allowed':'pointer', boxShadow: saving?'none':'0 0 16px #3b82f644' }}>
            {saving ? '创建中...' : '✓ 创建待办'}
          </button>
        </div>
      </div>
    </div>
  )
}
