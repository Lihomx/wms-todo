'use client'
import { useEffect } from 'react'
export default function WarehouseOmsData() {
  useEffect(()=>{ window.location.replace('/wms/oms-data') },[])
  return <div style={{padding:'40px',textAlign:'center' as const,color:'#94a3b8',background:'#f8fafc',flex:1}}>跳转中...</div>
}
