// lib/supabase.ts
// 共享类型定义
// ⚠️  不要在这里导入或重导出任何 supabase client！
// 客户端组件: import { getSupabaseBrowserClient } from '@/lib/supabase-browser'
// 服务端/API:  import { getSupabaseServerClient, getSupabaseAdminClient } from '@/lib/supabase-server'

export type TodoStatus   = 0 | 1 | 2 | 3
export type TodoPriority = 1 | 2 | 3
export type AuthStatus   = 0 | 1 | 2 | 3

export interface Tenant {
  id: string; name: string; warehouse_code: string
  contact_name: string; contact_email: string
  timezone: string; status: number; created_at: string
}

export interface Todo {
  id: string; tenant_id: string; title: string; description?: string
  category: string; priority: TodoPriority; status: TodoStatus
  due_date?: string; completed_at?: string
  source: 'manual' | 'lingxing_auto'
  lingxing_order_no?: string; lingxing_data?: Record<string, unknown>
  assignee_id?: string; created_at: string; updated_at: string
  checklist_items?: ChecklistItem[]
}

export interface ChecklistItem {
  id: string; todo_id: string; content: string
  is_done: boolean; done_at?: string; due_date?: string; sort_order: number
}

export interface InventoryWarning {
  id: string; tenant_id: string; sku: string; sku_name: string
  warning_qty: number; current_qty: number; is_active: boolean
}

export interface SyncLog {
  id: string; tenant_id: string; sync_type: string
  status: 'running' | 'success' | 'failed'
  records_fetched: number; todos_created: number; todos_updated: number
  error_msg?: string; duration_ms?: number
  started_at: string; finished_at?: string
}
