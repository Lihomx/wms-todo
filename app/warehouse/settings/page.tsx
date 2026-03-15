'use client'
import { useState, useEffect } from 'react'

type Theme = 'light' | 'dark'

export default function WarehouseSettings() {
  const [theme, setTheme] = useState<Theme>('light')
  const [saved, setSaved] = useState(false)

  useEffect(()=>{
    const saved = localStorage.getItem('wms-theme') as Theme ?? 'light'
    setTheme(saved)
  },[])

  const saveTheme = (t: Theme) => {
    setTheme(t)
    localStorage.setItem('wms-theme', t)
    setSaved(true)
    setTimeout(()=>setSaved(false), 2000)
    // Apply immediately
    document.documentElement.setAttribute('data-theme', t)
  }

  const card:React.CSSProperties={background:'#fff',border:'1px solid #e2e8f0',borderRadius:'10px',padding:'20px',marginBottom:'14px',boxShadow:'0 1px 3px rgba(0,0,0,0.05)'}

  return (
    <div style={{flex:1,overflowY:'auto' as const,background:'#f8fafc',padding:'28px 32px'}}>
      <div style={{maxWidth:'560px'}}>
        <div style={{marginBottom:'22px'}}>
          <h1 style={{fontSize:'20px',fontWeight:700,color:'#0f172a'}}>系统设置</h1>
          <p style={{fontSize:'13px',color:'#64748b',marginTop:'3px'}}>界面和系统偏好设置</p>
        </div>

        {/* Theme selector */}
        <div style={card}>
          <div style={{fontSize:'14px',fontWeight:600,color:'#0f172a',marginBottom:'14px'}}>🎨 界面风格</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'10px',marginBottom:'14px'}}>
            {/* Light theme option */}
            <div onClick={()=>saveTheme('light')} style={{padding:'16px',borderRadius:'8px',border:`2px solid ${theme==='light'?'#2563eb':'#e2e8f0'}`,cursor:'pointer',background:theme==='light'?'#eff6ff':'#fff',transition:'all 0.15s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <span style={{fontSize:'13px',fontWeight:600,color:'#0f172a'}}>浅色模式</span>
                {theme==='light' && <span style={{width:'18px',height:'18px',borderRadius:'50%',background:'#2563eb',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'white'}}>✓</span>}
              </div>
              {/* Preview */}
              <div style={{background:'#f8fafc',borderRadius:'6px',padding:'8px',border:'1px solid #e2e8f0'}}>
                <div style={{height:'6px',borderRadius:'3px',background:'#0f172a',width:'60%',marginBottom:'5px'}}/>
                <div style={{height:'5px',borderRadius:'3px',background:'#e2e8f0',width:'80%',marginBottom:'4px'}}/>
                <div style={{height:'5px',borderRadius:'3px',background:'#e2e8f0',width:'50%'}}/>
              </div>
            </div>
            {/* Dark theme option */}
            <div onClick={()=>saveTheme('dark')} style={{padding:'16px',borderRadius:'8px',border:`2px solid ${theme==='dark'?'#60a5fa':'#e2e8f0'}`,cursor:'pointer',background:theme==='dark'?'#1e3a5f':'#fff',transition:'all 0.15s'}}>
              <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:'10px'}}>
                <span style={{fontSize:'13px',fontWeight:600,color:theme==='dark'?'#f1f5f9':'#0f172a'}}>深色模式</span>
                {theme==='dark' && <span style={{width:'18px',height:'18px',borderRadius:'50%',background:'#3b82f6',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'11px',color:'white'}}>✓</span>}
              </div>
              {/* Preview */}
              <div style={{background:'#161b26',borderRadius:'6px',padding:'8px',border:'1px solid #2a3250'}}>
                <div style={{height:'6px',borderRadius:'3px',background:'#f1f5f9',width:'60%',marginBottom:'5px'}}/>
                <div style={{height:'5px',borderRadius:'3px',background:'#2a3250',width:'80%',marginBottom:'4px'}}/>
                <div style={{height:'5px',borderRadius:'3px',background:'#2a3250',width:'50%'}}/>
              </div>
            </div>
          </div>
          {saved && <div style={{padding:'8px 12px',borderRadius:'7px',background:'#f0fdf4',border:'1px solid #bbf7d0',color:'#16a34a',fontSize:'12px'}}>✅ 界面风格已保存</div>}
          <p style={{fontSize:'12px',color:'#94a3b8',marginTop:'10px'}}>深色模式需刷新页面生效</p>
        </div>

        {/* System info */}
        <div style={card}>
          <div style={{fontSize:'14px',fontWeight:600,color:'#0f172a',marginBottom:'12px'}}>ℹ️ 系统信息</div>
          {[
            {label:'系统版本', value:'v2.0.0'},
            {label:'API凭证管理', value:'客户管理页面'},
            {label:'数据同步', value:'仓库管理端 → 数据同步'},
          ].map(item=>(
            <div key={item.label} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid #f1f5f9'}}>
              <span style={{fontSize:'13px',color:'#64748b'}}>{item.label}</span>
              <span style={{fontSize:'13px',color:'#0f172a',fontWeight:500}}>{item.value}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
