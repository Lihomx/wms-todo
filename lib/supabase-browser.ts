import { createClient, SupabaseClient } from '@supabase/supabase-js'

// DO NOT cache the client - always create fresh to avoid stale session issues
export function getSupabaseBrowserClient(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        storageKey: 'wms-auth',
        storage: typeof window !== 'undefined' ? window.localStorage : undefined,
      }
    }
  )
}
