import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET() {
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase.from('scan_settings')
    .select('*').order('id').limit(10)
  if (error) {
    // Table may not exist yet
    if (error.code === '42P01') return NextResponse.json({ settings: getDefaults() })
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ settings: data?.length ? data : getDefaults() })
}

export async function POST(req: NextRequest) {
  const body = await req.json()
  const supabase = getSupabaseAdminClient()
  if (body.id) {
    const { id, ...upd } = body
    upd.updated_at = new Date().toISOString()
    const { error } = await supabase.from('scan_settings').update(upd).eq('id', id)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ success: true })
  }
  const { data, error } = await supabase.from('scan_settings').insert(body).select().single()
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ setting: data })
}

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })
  const supabase = getSupabaseAdminClient()
  await supabase.from('scan_settings').delete().eq('id', id)
  return NextResponse.json({ success: true })
}

function getDefaults() {
  return [{
    id: 1, name: '默认扫描规则', is_active: true, free_mode: false,
    extract_rules: [
      { type: 'json_field', field: 'id',           label: '提取JSON id字段' },
      { type: 'json_field', field: 'reference_id', label: '提取JSON reference_id字段' },
      { type: 'regex', pattern: '([\\w/\\-]+)', group: 1, label: '提取字母数字组合' },
    ],
    prefix_strip: '', suffix_strip: '', regex_replace: '', regex_with: '',
    sku_prefix_match: true, sku_exact_match: false,
  }]
}
