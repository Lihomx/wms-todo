import { redirect } from 'next/navigation'

// Simple redirect - no server-side auth check to avoid next/headers issues
export default function RootPage() {
  redirect('/auth/login')
}
