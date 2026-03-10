import { redirect } from 'next/navigation'
import { getSupabaseServerClient } from '@/lib/supabase'

export default async function RootPage() {
  const supabase = getSupabaseServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/wms/dashboard')
  } else {
    redirect('/auth/login')
  }
}
