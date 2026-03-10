create extension if not exists "uuid-ossp";

create table if not exists tenants (
  id              uuid primary key default uuid_generate_v4(),
  name            text not null,
  warehouse_code  text,
  status          smallint default 1,
  created_at      timestamptz default now()
);

create table if not exists lingxing_credentials (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid references tenants(id) on delete cascade unique,
  app_key           text,
  app_secret        text,
  access_token      text,
  refresh_token     text,
  token_expire_at   timestamptz,
  warehouse_ids     jsonb default '[]',
  auth_status       smallint default 0,
  last_sync_at      timestamptz,
  sync_enabled      boolean default true,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now()
);

create table if not exists todos (
  id                uuid primary key default uuid_generate_v4(),
  tenant_id         uuid references tenants(id) on delete cascade,
  title             text not null,
  description       text,
  category          text not null,
  priority          smallint default 2,
  status            smallint default 0,
  due_date          date,
  completed_at      timestamptz,
  source            text default 'manual',
  lingxing_order_no text,
  lingxing_data     jsonb,
  created_at        timestamptz default now(),
  updated_at        timestamptz default now(),
  constraint unique_tenant_order unique(tenant_id, lingxing_order_no)
);

create table if not exists checklist_items (
  id          uuid primary key default uuid_generate_v4(),
  todo_id     uuid references todos(id) on delete cascade,
  content     text not null,
  is_done     boolean default false,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

create table if not exists inventory_warnings (
  id          uuid primary key default uuid_generate_v4(),
  tenant_id   uuid references tenants(id) on delete cascade,
  sku         text not null,
  sku_name    text,
  warning_qty int default 50,
  is_active   boolean default true,
  unique(tenant_id, sku)
);

create index if not exists idx_todos_tenant  on todos(tenant_id, status);
create index if not exists idx_todos_cat     on todos(category);
create index if not exists idx_check_todo    on checklist_items(todo_id);

-- Seed default tenant
insert into tenants (id, name, warehouse_code)
values ('a0000000-0000-0000-0000-000000000001', 'LIHO 海外仓', 'LA仓')
on conflict do nothing;
