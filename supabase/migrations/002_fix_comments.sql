-- Fix: Add author_name column to todo_comments (if table already exists without it)
-- Run this in Supabase SQL Editor

-- If table doesn't exist, create it
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

-- If table exists but missing author_name column, add it
ALTER TABLE todo_comments ADD COLUMN IF NOT EXISTS author_name TEXT NOT NULL DEFAULT '仓库管理员';

-- Drop author_id if it exists (was the old FK approach)
ALTER TABLE todo_comments DROP COLUMN IF EXISTS author_id;

CREATE INDEX IF NOT EXISTS idx_todo_comments_todo_id ON todo_comments(todo_id);
ALTER TABLE todo_comments DISABLE ROW LEVEL SECURITY;

-- Force schema cache reload
NOTIFY pgrst, 'reload schema';
