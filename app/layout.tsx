import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: '海外仓 WMS 待办管理系统',
  description: '海外仓仓库待办管理，对接领星WMS数据自动生成待办',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  )
}
