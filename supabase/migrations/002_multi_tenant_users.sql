-- ============================================================
-- Migration 002: Multi-tenant Users, Roles, Comments, Reminders
-- ============================================================

-- 1. User profiles (links to Supabase Auth)
CREATE TABLE IF NOT EXISTS user_profiles (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id     UUID REFERENCES tenants(id) ON DELETE CASCADE,
  warehouse_id  TEXT,  -- null = warehouse admin (sees all), set = OMS client user
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'operator',
  -- roles: 'warehouse_admin' | 'warehouse_staff' | 'client_admin' | 'client_operator'
  language      TEXT NOT NULL DEFAULT 'zh',  -- 'zh' | 'es'
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW(),
  updated_at    TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add assignee to todos
ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_to UUID REFERENCES user_profiles(id);
ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_by UUID REFERENCES user_profiles(id);
ALTER TABLE todos ADD COLUMN IF NOT EXISTS assigned_at TIMESTAMPTZ;

-- 3. Todo comments (with bilingual support)
CREATE TABLE IF NOT EXISTS todo_comments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id         UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  author_id       UUID NOT NULL REFERENCES user_profiles(id),
  content_original TEXT NOT NULL,          -- original input
  content_zh      TEXT,                    -- Chinese version
  content_es      TEXT,                    -- Spanish version
  original_lang   TEXT NOT NULL DEFAULT 'zh',  -- detected language
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Daily reminder log (prevent duplicates)
CREATE TABLE IF NOT EXISTS reminder_logs (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id     UUID REFERENCES todos(id) ON DELETE CASCADE,
  sent_to     TEXT NOT NULL,  -- email
  sent_at     TIMESTAMPTZ DEFAULT NOW(),
  reminder_date DATE NOT NULL  -- date of reminder
);

-- 5. OMS clients list (synced from OMS API)
CREATE TABLE IF NOT EXISTS oms_clients (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  customer_code   TEXT NOT NULL UNIQUE,  -- e.g. '5629030'
  customer_name   TEXT NOT NULL,
  oms_account     TEXT,  -- OMS manager account
  company_name    TEXT,
  status          TEXT DEFAULT 'active',
  can_use_warehouse INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);

-- 6. RLS Policies
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE todo_comments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE oms_clients    ENABLE ROW LEVEL SECURITY;
ALTER TABLE reminder_logs  ENABLE ROW LEVEL SECURITY;

-- Warehouse admins can see all
CREATE POLICY "service_role_all" ON user_profiles FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON todo_comments  FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON oms_clients    FOR ALL USING (TRUE);
CREATE POLICY "service_role_all" ON reminder_logs  FOR ALL USING (TRUE);

-- 7. Indexes
CREATE INDEX IF NOT EXISTS idx_todo_comments_todo_id ON todo_comments(todo_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_tenant   ON user_profiles(tenant_id);
CREATE INDEX IF NOT EXISTS idx_todos_assigned_to      ON todos(assigned_to);
CREATE INDEX IF NOT EXISTS idx_reminder_logs_date     ON reminder_logs(reminder_date, sent_to);
