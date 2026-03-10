// lib/supabase.ts
// Supabase 客户端封装 - 同时支持浏览器端和服务端

import { createClient } from '@supabase/supabase-js'
import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── 数据库类型定义 ──────────────────────────────────────────
export type TodoStatus = 0 | 1 | 2 | 3   // 待处理/进行中/已完成/已取消
export type TodoPriority = 1 | 2 | 3     // 紧急/普通/低优
export type AuthStatus = 0 | 1 | 2 | 3  // 未绑定/已绑定/已过期/绑定失败

export interface Tenant {
  id: string
  name: string
  warehouse_code: string
  contact_name: string
  contact_email: string
  timezone: string
  status: number
  created_at: string
}

export interface LingxingCredential {
  id: string
  tenant_id: string
  app_key: string
  app_secret: string
  access_token: string
  refresh_token: string
  token_expire_at: string
  seller_id: string
  warehouse_ids: string[]
  auth_status: AuthStatus
  last_sync_at: string
  sync_enabled: boolean
}

export interface Todo {
  id: string
  tenant_id: string
  title: string
  description?: string
  category: string
  priority: TodoPriority
  status: TodoStatus
  due_date?: string
  completed_at?: string
  source: 'manual' | 'lingxing_auto'
  lingxing_order_no?: string
  lingxing_data?: Record<string, unknown>
  assignee_id?: string
  created_at: string
  updated_at: string
  checklist_items?: ChecklistItem[]
}

export interface ChecklistItem {
  id: string
  todo_id: string
  content: string
  is_done: boolean
  done_at?: string
  due_date?: string
  sort_order: number
}

export interface InventoryWarning {
  id: string
  tenant_id: string
  sku: string
  sku_name: string
  warning_qty: number
  current_qty: number
  is_active: boolean
}

export interface SyncLog {
  id: string
  tenant_id: string
  sync_type: string
  status: 'running' | 'success' | 'failed'
  records_fetched: number
  todos_created: number
  todos_updated: number
  error_msg?: string
  duration_ms?: number
  started_at: string
  finished_at?: string
}

// ── 浏览器端 Supabase 客户端（单例） ─────────────────────────
let browserClient: ReturnType<typeof createClient> | null = null

export function getSupabaseBrowserClient() {
  if (browserClient) return browserClient
  browserClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    }
  )
  return browserClient
}

// ── 服务端 Supabase 客户端（每次请求新建） ────────────────────
export function getSupabaseServerClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return cookieStore.get(name)?.value
        },
        set(name: string, value: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value, ...options })
          } catch {}
        },
        remove(name: string, options: CookieOptions) {
          try {
            cookieStore.set({ name, value: '', ...options })
          } catch {}
        },
      },
    }
  )
}

// ── 服务端管理员客户端（绕过RLS，用于同步任务） ───────────────
export function getSupabaseAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
