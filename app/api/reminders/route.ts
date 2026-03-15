/* eslint-disable @typescript-eslint/no-explicit-any */
import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

const DEFAULT_TENANT = process.env.NEXT_PUBLIC_DEFAULT_TENANT_ID ?? 'a0000000-0000-0000-0000-000000000001'

async function sendEmail(to: string, subject: string, html: string) {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) return { error: 'RESEND_API_KEY not set' }
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: 'WMS待办 <reminder@wms.yourdomain.com>', to, subject, html })
  })
  return res.json()
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}))
    const today = new Date().toISOString().split('T')[0]
    const supabase = getSupabaseAdminClient()

    const { data: todos } = await supabase
      .from('todos')
      .select('id,title,category,priority,due_date,status,assigned_to')
      .eq('tenant_id', DEFAULT_TENANT)
      .in('status', [0, 1])
      .not('assigned_to', 'is', null)

    if (!todos || todos.length === 0) return NextResponse.json({ message: '没有需要提醒的待办', sent: 0 })

    const assigneeIds = [...new Set(todos.map((t:any) => t.assigned_to))]
    const { data: profiles } = await supabase.from('user_profiles')
      .select('id,email,display_name,language').in('id', assigneeIds)

    const profileMap: Record<string, any> = {}
    for (const p of profiles ?? []) profileMap[p.id] = p

    const byAssignee: Record<string, any[]> = {}
    for (const t of todos) {
      const profile = profileMap[(t as any).assigned_to]
      if (!profile?.email) continue
      if (!byAssignee[profile.id]) byAssignee[profile.id] = []
      byAssignee[profile.id].push({ ...t, profile })
    }

    let sent = 0
    for (const tasks of Object.values(byAssignee)) {
      const profile = tasks[0].profile
      const { data: existing } = await supabase.from('reminder_logs')
        .select('id').eq('sent_to', profile.email).eq('reminder_date', today).limit(1)
      if (body.force !== true && existing && existing.length > 0) continue

      const isEs = profile.language === 'es'
      const subject = isEs ? `[WMS] Recordatorio - ${today}` : `[WMS] 今日待办提醒 - ${today}`
      const rows = tasks.map((t:any) => `<tr><td style="padding:8px 12px;border-bottom:1px solid #eee">${t.title}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${t.category}</td><td style="padding:8px 12px;border-bottom:1px solid #eee;color:${t.status===0?'#f97316':'#3b82f6'}">${t.status===0?(isEs?'Pendiente':'待处理'):(isEs?'En progreso':'进行中')}</td><td style="padding:8px 12px;border-bottom:1px solid #eee">${t.due_date??'-'}</td></tr>`).join('')
      const html = `<div style="font-family:sans-serif;max-width:600px"><h2 style="color:#3b82f6">${isEs?'Recordatorio de tareas':'每日待办提醒'}</h2><p>${isEs?`Hola ${profile.display_name}, tienes ${tasks.length} tarea(s):`:`${profile.display_name}，您有 ${tasks.length} 条待办：`}</p><table style="width:100%;border-collapse:collapse"><thead><tr style="background:#f1f5f9"><th style="padding:8px 12px;text-align:left">标题/Título</th><th style="padding:8px 12px;text-align:left">分类</th><th style="padding:8px 12px;text-align:left">状态</th><th style="padding:8px 12px;text-align:left">截止</th></tr></thead><tbody>${rows}</tbody></table></div>`

      const result = await sendEmail(profile.email, subject, html)
      if (!result.error) {
        await supabase.from('reminder_logs').insert({ todo_id: tasks[0].id, sent_to: profile.email, reminder_date: today })
        sent++
      }
    }
    return NextResponse.json({ message: `发送完成，共 ${sent} 封`, sent })
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 })
  }
}
