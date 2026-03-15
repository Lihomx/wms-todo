'use client'
import { useEffect } from 'react'

export default function HomePage() {
  useEffect(() => {
    window.location.replace('/warehouse/dashboard')
  }, [])
  return (
    <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#f8fafc',color:'#94a3b8',fontSize:'14px'}}>
      跳转中...
    </div>
  )
}
