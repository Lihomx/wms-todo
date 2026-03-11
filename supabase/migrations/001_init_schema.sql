-- ============================================================
-- 海外仓WMS待办系统 · Supabase Schema
-- 领星OMS对接版
-- ============================================================

-- 租户表
CREATE TABLE IF NOT EXISTS tenants (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 默认租户（测试用）
INSERT INTO tenants (id, name) VALUES
  ('a0000000-0000-0000-0000-000000000001', '默认仓库')
ON CONFLICT DO NOTHING;

-- 领星OMS凭证表
CREATE TABLE IF NOT EXISTS lingxing_credentials (
  tenant_id      UUID PRIMARY KEY REFERENCES tenants(id) ON DELETE CASCADE,
  app_key        TEXT NOT NULL,           -- AES-256 加密存储
  app_secret     TEXT NOT NULL,           -- AES-256 加密存储
  warehouse_ids  TEXT[],                  -- 绑定的仓库ID列表
  auth_status    INTEGER DEFAULT 0,       -- 0=未验证 1=已激活 2=已失效
  sync_enabled   BOOLEAN DEFAULT true,    -- 是否参与定时同步
  last_sync_at   TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now(),
  updated_at     TIMESTAMPTZ DEFAULT now()
);

-- 待办主表
CREATE TABLE IF NOT EXISTS todos (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id          UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  title              TEXT NOT NULL,
  category           TEXT NOT NULL DEFAULT '其他',   -- 入库作业/出库作业/库存管理/退货处理/工单
  priority           INTEGER DEFAULT 2,              -- 1=紧急 2=普通 3=低优先级
  status             INTEGER DEFAULT 0,              -- 0=待处理 1=处理中 2=已完成 3=已取消
  due_date           DATE,
  assignee_id        UUID,                           -- 指派给哪个用户
  source             TEXT DEFAULT 'manual',          -- manual / lingxing_auto
  lingxing_order_no  TEXT,                           -- 来自OMS的单号，防重复
  notes              TEXT,
  created_at         TIMESTAMPTZ DEFAULT now(),
  updated_at         TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, lingxing_order_no)
);

-- 检查项表（每个待办的子步骤）
CREATE TABLE IF NOT EXISTS checklist_items (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  todo_id     UUID NOT NULL REFERENCES todos(id) ON DELETE CASCADE,
  content     TEXT NOT NULL,
  is_done     BOOLEAN DEFAULT false,
  sort_order  INTEGER DEFAULT 0,
  done_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- 库存预警配置
CREATE TABLE IF NOT EXISTS inventory_warnings (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  sku         TEXT NOT NULL,
  warning_qty INTEGER NOT NULL DEFAULT 50,
  is_active   BOOLEAN DEFAULT true,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE(tenant_id, sku)
);

-- 用户扩展表（绑定 Supabase Auth 用户）
CREATE TABLE IF NOT EXISTS user_profiles (
  id          UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  tenant_id   UUID REFERENCES tenants(id),
  role        TEXT DEFAULT 'operator',   -- superadmin / admin / operator
  display_name TEXT,
  created_at  TIMESTAMPTZ DEFAULT now()
);

-- ── Indexes ──────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_todos_tenant_status   ON todos(tenant_id, status);
CREATE INDEX IF NOT EXISTS idx_todos_tenant_category ON todos(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_todos_due_date        ON todos(due_date);
CREATE INDEX IF NOT EXISTS idx_checklist_todo_id     ON checklist_items(todo_id);

-- ── Row Level Security ────────────────────────────────────────
ALTER TABLE todos              ENABLE ROW LEVEL SECURITY;
ALTER TABLE checklist_items    ENABLE ROW LEVEL SECURITY;
ALTER TABLE inventory_warnings ENABLE ROW LEVEL SECURITY;
ALTER TABLE lingxing_credentials ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_profiles      ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's tenant_id
CREATE OR REPLACE FUNCTION get_my_tenant_id()
RETURNS UUID LANGUAGE SQL STABLE AS $$
  SELECT tenant_id FROM user_profiles WHERE id = auth.uid()
$$;

-- Helper: get current user's role
CREATE OR REPLACE FUNCTION get_my_role()
RETURNS TEXT LANGUAGE SQL STABLE AS $$
  SELECT role FROM user_profiles WHERE id = auth.uid()
$$;

-- Todos: users see only their tenant's data
CREATE POLICY "todos_tenant_isolation" ON todos
  USING (tenant_id = get_my_tenant_id());

CREATE POLICY "todos_tenant_insert" ON todos FOR INSERT
  WITH CHECK (tenant_id = get_my_tenant_id());

CREATE POLICY "todos_tenant_update" ON todos FOR UPDATE
  USING (tenant_id = get_my_tenant_id());

-- Checklist: via todo
CREATE POLICY "checklist_via_todo" ON checklist_items
  USING (todo_id IN (SELECT id FROM todos WHERE tenant_id = get_my_tenant_id()));

-- Inventory warnings: tenant isolation
CREATE POLICY "inv_warn_tenant" ON inventory_warnings
  USING (tenant_id = get_my_tenant_id());

-- Credentials: only admin can see
CREATE POLICY "creds_admin_only" ON lingxing_credentials
  USING (tenant_id = get_my_tenant_id() AND get_my_role() IN ('admin', 'superadmin'));

-- User profiles: own row only
CREATE POLICY "profiles_own" ON user_profiles
  USING (id = auth.uid());

-- ── Auto-update updated_at ────────────────────────────────────
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

CREATE TRIGGER todos_updated_at
  BEFORE UPDATE ON todos
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER creds_updated_at
  BEFORE UPDATE ON lingxing_credentials
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
