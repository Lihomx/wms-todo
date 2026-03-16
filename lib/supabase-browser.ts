import { createClient } from '@supabase/supabase-js'

// Singleton - one instance per browser session
// Uses default storage key (sb-<ref>-auth-token) so sessions persist correctly
let client: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowserClient() {
  if (!client) {
    client = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    )
  }
  return client
}
