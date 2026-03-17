import { NextRequest, NextResponse } from 'next/server'
import { getSupabaseAdminClient } from '@/lib/supabase-server'

export async function GET(req: NextRequest) {
  const cp = new URL(req.url).searchParams.get('cp')?.trim()
  if (!cp || !/^\d{5}$/.test(cp)) {
    return NextResponse.json({ error: 'Ingresa un código postal de 5 dígitos' }, { status: 400 })
  }
  const supabase = getSupabaseAdminClient()
  const { data, error } = await supabase
    .from('mx_sepomex')
    .select('colonia, municipio, estado')
    .eq('cp', cp)
    .order('colonia')
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  if (!data?.length) return NextResponse.json({ error: `No se encontró el CP ${cp}` }, { status: 404 })
  return NextResponse.json({
    cp,
    municipio: data[0].municipio,
    estado:    data[0].estado,
    colonias:  data.map(d => d.colonia),
  })
}
