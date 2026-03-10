-- ============================================================
-- 海外仓WMS待办系统 - 完整数据库结构
-- 在 Supabase Dashboard → SQL Editor 中执行此文件
-- ============================================================

-- 启用 UUID 扩展
create extension if not exists "uuid-ossp";

-- ============================================================
-- 1. 租户表（每个仓库客户一条记录）
-- ============================================================
create table if not exists tenants (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,                    -- 公司/仓库名称
  warehouse_code  text,                             -- 仓库代码 如 LA仓
  contact_name    text,                             -- 联系人
  contact_email   text,                             -- 联系邮箱
  timezone        text default 'America/Los_Angeles', -- 时区
  status          smallint default 1,               -- 1启用 0停用
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- 2. 用户表（操作人员）
-- ============================================================
create table if not exists users (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  email           text unique not null,
  full_name       text,
  role            text default 'operator',  -- admin/manager/operator
  avatar_url      text,
  status          smallint default 1,
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- 3. 领星API凭证表（核心）
-- ============================================================
create table if not exists lingxing_credentials (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid references tenants(id) on delete cascade unique,
  app_key           text,                   -- AES加密存储
  app_secret        text,                   -- AES加密存储
  access_token      text,                   -- 当前有效Token
  refresh_token     text,                   -- 刷新Token
  token_expire_at   timestamptz,            -- Token过期时间
  seller_id         text,                   -- 领星卖家ID
  warehouse_ids     jsonb default '[]',     -- 授权仓库ID列表
  auth_status       smallint default 0,     -- 0未绑定 1已绑定 2已过期 3绑定失败
  last_sync_at      timestamptz,            -- 最后同步时间
  sync_enabled      boolean default true,   -- 是否开启自动同步
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

-- ============================================================
-- 4. 待办主表
-- ============================================================
create table if not exists todos (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid references tenants(id) on delete cascade,
  title             text not null,
  description       text,
  category          text not null,           -- 入库作业/出库作业/库存管理/退货处理/工单/截单/转运/FBA退货
  priority          smallint default 2,      -- 1紧急 2普通 3低优
  status            smallint default 0,      -- 0待处理 1进行中 2已完成 3已取消
  due_date          date,
  completed_at      timestamptz,
  source            text default 'manual',   -- manual/lingxing_auto
  lingxing_order_no text,                    -- 关联领星单号（用于幂等去重）
  lingxing_data     jsonb,                   -- 领星原始数据快照
  assignee_id       uuid references users(id),
  created_by        uuid references users(id),
  sort_order        int default 0,
  tags              text[] default '{}',
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),

  -- 防重复索引：同一租户同一领星单号只能有一条待办
  constraint unique_tenant_order unique(tenant_id, lingxing_order_no)
);

-- ============================================================
-- 5. 检查项表
-- ============================================================
create table if not exists checklist_items (
  id          uuid primary key default uuid_generate_v4(),
  todo_id     uuid references todos(id) on delete cascade,
  content     text not null,
  is_done     boolean default false,
  done_at     timestamptz,
  done_by     uuid references users(id),
  due_date    date,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

-- ============================================================
-- 6. 库存预警配置表
-- ============================================================
create table if not exists inventory_warnings (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  sku             text not null,
  sku_name        text,
  warning_qty     int default 50,    -- 低于此值触发预警
  current_qty     int default 0,     -- 当前库存（同步更新）
  is_active       boolean default true,
  last_warned_at  timestamptz,       -- 上次触发预警时间（防重复）
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(tenant_id, sku)
);

-- ============================================================
-- 7. 同步日志表
-- ============================================================
create table if not exists sync_logs (
  id              uuid primary key default uuid_generate_v4(),
  tenant_id       uuid references tenants(id) on delete cascade,
  sync_type       text,              -- all/inbound/outbound/inventory/return
  status          text,              -- running/success/failed
  records_fetched int default 0,     -- 从领星拉取的记录数
  todos_created   int default 0,     -- 新建待办数
  todos_updated   int default 0,     -- 更新待办数
  error_msg       text,
  duration_ms     int,               -- 耗时毫秒
  started_at      timestamptz default now(),
  finished_at     timestamptz
);

-- ============================================================
-- 8. 自动更新 updated_at 触发器
-- ============================================================
create or replace function update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger tenants_updated_at
  before update on tenants
  for each row execute function update_updated_at_column();

create trigger users_updated_at
  before update on users
  for each row execute function update_updated_at_column();

create trigger lingxing_credentials_updated_at
  before update on lingxing_credentials
  for each row execute function update_updated_at_column();

create trigger todos_updated_at
  before update on todos
  for each row execute function update_updated_at_column();

create trigger inventory_warnings_updated_at
  before update on inventory_warnings
  for each row execute function update_updated_at_column();

-- ============================================================
-- 9. 性能索引
-- ============================================================
create index if not exists idx_todos_tenant_status    on todos(tenant_id, status);
create index if not exists idx_todos_tenant_category  on todos(tenant_id, category);
create index if not exists idx_todos_due_date         on todos(due_date);
create index if not exists idx_todos_created_at       on todos(created_at desc);
create index if not exists idx_checklist_todo_id      on checklist_items(todo_id);
create index if not exists idx_sync_logs_tenant       on sync_logs(tenant_id, started_at desc);
create index if not exists idx_inventory_tenant_sku   on inventory_warnings(tenant_id, sku);

-- ============================================================
-- 10. Row Level Security (RLS) - 多租户数据隔离
-- ============================================================
alter table tenants              enable row level security;
alter table users                enable row level security;
alter table lingxing_credentials enable row level security;
alter table todos                enable row level security;
alter table checklist_items      enable row level security;
alter table inventory_warnings   enable row level security;
alter table sync_logs            enable row level security;

-- 待办表RLS策略：只能看自己租户的数据
create policy "tenant_isolation_todos" on todos
  for all using (
    tenant_id = (
      select tenant_id from users
      where id = auth.uid()
    )
  );

-- 检查项跟随待办的租户隔离
create policy "tenant_isolation_checklist" on checklist_items
  for all using (
    todo_id in (
      select id from todos
      where tenant_id = (
        select tenant_id from users where id = auth.uid()
      )
    )
  );

-- ============================================================
-- 11. 测试种子数据（可选，开发测试用）
-- ============================================================
insert into tenants (id, name, warehouse_code, contact_name, contact_email)
values (
  'a0000000-0000-0000-0000-000000000001',
  'LIHO 海外仓',
  'LA仓',
  '测试管理员',
  'admin@liho-wms.com'
) on conflict do nothing;
