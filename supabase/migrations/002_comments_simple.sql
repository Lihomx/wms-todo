-- ============================================================
-- Migration 002 (Simple): Comments table without user_profiles FK
-- Run this in Supabase SQL Editor
-- ============================================================

-- Simple comments table - no foreign key dependency
CREATE TABLE IF NOT EXISTS todo_comments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id          UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  author_name      TEXT NOT NULL DEFAULT '仓库管理员',
  content_original TEXT NOT NULL,
  content_zh       TEXT,
  content_es       TEXT,
  original_lang    TEXT NOT NULL DEFAULT 'zh',
  created_at       TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_todo_comments_todo_id ON todo_comments(todo_id);

-- Disable RLS for now (service role handles security)
ALTER TABLE todo_comments DISABLE ROW LEVEL SECURITY;

-- Notify PostgREST to reload schema
NOTIFY pgrst, 'reload schema';
