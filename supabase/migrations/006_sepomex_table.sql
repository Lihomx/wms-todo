-- Migration 006: Mexican postal code lookup table (SEPOMEX)
-- After creating this table, import the full data via Supabase Dashboard > Table Editor > Import CSV
-- OR run the import script via psql

CREATE TABLE IF NOT EXISTS mx_sepomex (
  id        BIGSERIAL PRIMARY KEY,
  cp        VARCHAR(5)   NOT NULL,
  colonia   VARCHAR(100),
  municipio VARCHAR(100),
  estado    VARCHAR(100)
);

CREATE INDEX IF NOT EXISTS idx_mx_sepomex_cp ON mx_sepomex(cp);
ALTER TABLE mx_sepomex DISABLE ROW LEVEL SECURITY;

-- Allow public read access (for postcode lookup)
GRANT SELECT ON mx_sepomex TO anon, authenticated;

-- Shipping orders table: stores labels created via打单系统
CREATE TABLE IF NOT EXISTS shipping_orders (
  id                BIGSERIAL PRIMARY KEY,
  tenant_id         UUID REFERENCES tenants(id),
  customer_code     TEXT NOT NULL,
  customer_name     TEXT,
  
  -- Origin (sender)
  origin_name       TEXT,
  origin_phone      TEXT,
  origin_email      TEXT,
  origin_company    TEXT,
  origin_address    TEXT,
  origin_cp         TEXT,
  origin_colonia    TEXT,
  origin_city       TEXT,
  origin_state      TEXT,
  
  -- Destination (receiver)
  dest_name         TEXT NOT NULL,
  dest_phone        TEXT NOT NULL,
  dest_email        TEXT,
  dest_address      TEXT NOT NULL,
  dest_cp           TEXT NOT NULL,
  dest_colonia      TEXT NOT NULL,
  dest_city         TEXT NOT NULL,
  dest_state        TEXT NOT NULL,
  
  -- Package
  pkg_content       TEXT,
  pkg_length        DECIMAL,
  pkg_width         DECIMAL,
  pkg_height        DECIMAL,
  pkg_weight        DECIMAL NOT NULL,
  
  -- Logistics
  logistics_channel TEXT,
  
  -- OMS result
  outbound_order_no TEXT,   -- 领星系统出库单号
  oms_status        TEXT DEFAULT 'pending',  -- pending/success/failed
  oms_error         TEXT,
  oms_response      JSONB,
  
  created_at        TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_shipping_orders_customer ON shipping_orders(customer_code);
CREATE INDEX IF NOT EXISTS idx_shipping_orders_outbound ON shipping_orders(outbound_order_no);
ALTER TABLE shipping_orders DISABLE ROW LEVEL SECURITY;

-- Warehouse sender address (fixed origin for all shipments)
CREATE TABLE IF NOT EXISTS warehouse_settings (
  id           SERIAL PRIMARY KEY,
  key          TEXT UNIQUE NOT NULL,
  value        TEXT,
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

-- Default LIHO warehouse address (can be updated via admin)
INSERT INTO warehouse_settings (key, value) VALUES
  ('origin_name',    'ZHENYUAN LI'),
  ('origin_phone',   '5514296243'),
  ('origin_email',   'LIHOMEXICO@GMAIL.COM'),
  ('origin_company', 'LIHO - CHIU'),
  ('origin_address', 'TORRE DEL CAMPO Manzana 294'),
  ('origin_cp',      '54743'),
  ('origin_colonia', 'Santa María Guadalupe las Torres'),
  ('origin_city',    'Cuautitlán Izcalli'),
  ('origin_state',   'México'),
  ('wh_code',        'LIHO')
ON CONFLICT (key) DO NOTHING;

ALTER TABLE warehouse_settings DISABLE ROW LEVEL SECURITY;

-- Client accounts table (managed by warehouse admin)
-- Links Supabase Auth users to specific OMS clients
CREATE TABLE IF NOT EXISTS client_accounts (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  customer_code TEXT NOT NULL REFERENCES oms_clients(customer_code) ON DELETE CASCADE,
  display_name  TEXT NOT NULL,
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'client_operator',
  is_active     BOOLEAN DEFAULT TRUE,
  created_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_client_accounts_email ON client_accounts(email);
CREATE INDEX IF NOT EXISTS idx_client_accounts_customer ON client_accounts(customer_code);
ALTER TABLE client_accounts DISABLE ROW LEVEL SECURITY;

-- Scan settings table
CREATE TABLE IF NOT EXISTS scan_settings (
  id           SERIAL PRIMARY KEY,
  tenant_id    UUID REFERENCES tenants(id),
  name         TEXT NOT NULL DEFAULT '默认扫描规则',
  is_active    BOOLEAN DEFAULT TRUE,
  free_mode    BOOLEAN DEFAULT FALSE,  -- skip SKU validation
  -- JSON extraction rules (applied in order)
  extract_rules JSONB DEFAULT '[
    {"type":"json_field","field":"id","label":"提取JSON中id字段"},
    {"type":"json_field","field":"reference_id","label":"提取JSON中reference_id字段"},
    {"type":"regex","pattern":"([\\\\w/]+)","group":1,"label":"提取字母数字/斜杠组合"}
  ]',
  -- Post-extraction transform
  prefix_strip  TEXT DEFAULT '',       -- strip this prefix
  suffix_strip  TEXT DEFAULT '',       -- strip this suffix
  regex_replace TEXT DEFAULT '',       -- regex to replace in extracted value
  regex_with    TEXT DEFAULT '',       -- replace with
  -- SKU matching
  sku_prefix_match BOOLEAN DEFAULT TRUE,  -- allow prefix match (SKU前缀匹配)
  sku_exact_match  BOOLEAN DEFAULT FALSE, -- require exact match
  created_at   TIMESTAMPTZ DEFAULT NOW(),
  updated_at   TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE scan_settings DISABLE ROW LEVEL SECURITY;

-- Insert default rule
INSERT INTO scan_settings (name, is_active, free_mode, sku_prefix_match)
VALUES ('默认扫描规则', TRUE, FALSE, TRUE)
ON CONFLICT DO NOTHING;

-- Temporary impersonation tokens for warehouse admin -> client portal access
CREATE TABLE IF NOT EXISTS impersonate_tokens (
  token        TEXT PRIMARY KEY,
  customer_code TEXT NOT NULL,
  customer_name TEXT,
  expires_at   TIMESTAMPTZ NOT NULL,
  used         BOOLEAN DEFAULT FALSE,
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE impersonate_tokens DISABLE ROW LEVEL SECURITY;
-- Auto-cleanup: tokens expire after 5 minutes

-- ─────────────────────────────────────────────────────────
-- J&T Express 打单系统 tables
-- ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS jt_config (
  k   TEXT PRIMARY KEY,
  v   TEXT
);
ALTER TABLE jt_config DISABLE ROW LEVEL SECURITY;

-- Seed defaults
INSERT INTO jt_config (k,v) VALUES
  ('shipping_method','JT-MX-CD-N'),
  ('api_url','http://jthq.rtb56.com/webservice/PublicService.asmx/ServiceInterfaceUTF8'),
  ('shipper','{}')
ON CONFLICT (k) DO NOTHING;

CREATE TABLE IF NOT EXISTS jt_clients (
  id           TEXT PRIMARY KEY,
  username     TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name         TEXT,
  company      TEXT,
  email        TEXT,
  phone        TEXT,
  client_code  TEXT
);
ALTER TABLE jt_clients DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS jt_orders (
  id           TEXT PRIMARY KEY,
  reference_no TEXT UNIQUE NOT NULL,
  data         JSONB,
  status       TEXT DEFAULT 'reviewing',
  tracking_no  TEXT DEFAULT '',
  jt_order_id  TEXT DEFAULT '',
  label_url    TEXT DEFAULT '',
  sync_error   TEXT DEFAULT '',
  client_code  TEXT DEFAULT '',
  client_name  TEXT DEFAULT '',
  created_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jt_orders_client ON jt_orders(client_code);
CREATE INDEX IF NOT EXISTS idx_jt_orders_status ON jt_orders(status);
ALTER TABLE jt_orders DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS jt_addresses (
  id          TEXT PRIMARY KEY,
  client_code TEXT NOT NULL,
  alias       TEXT NOT NULL,
  name        TEXT, company TEXT, phone TEXT,
  postcode    TEXT, colonia TEXT, city TEXT, state TEXT,
  street      TEXT, interior TEXT, reference TEXT,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_jt_addresses_client ON jt_addresses(client_code);
ALTER TABLE jt_addresses DISABLE ROW LEVEL SECURITY;

-- J&T admin credentials (password: admin123 - change after first login via settings)
-- Password hash is HMAC-SHA256: hash.salt format
INSERT INTO jt_config (k,v) VALUES
  ('admin_username', 'admin'),
  ('admin_password', 'admin123')  -- plain text initially, will be hashed on first use
ON CONFLICT (k) DO NOTHING;
