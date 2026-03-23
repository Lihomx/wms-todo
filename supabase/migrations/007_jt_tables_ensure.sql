-- Migration 007: Ensure J&T tables exist (idempotent)
-- Run this in Supabase SQL editor if you see "table jt_orders not found" errors

CREATE TABLE IF NOT EXISTS jt_config (
  k   TEXT PRIMARY KEY,
  v   TEXT
);
ALTER TABLE jt_config DISABLE ROW LEVEL SECURITY;

INSERT INTO jt_config (k,v) VALUES
  ('shipping_method','JT-MX-CD-N'),
  ('api_url','http://jthq.rtb56.com/webservice/PublicService.asmx/ServiceInterfaceUTF8'),
  ('shipper','{}'),
  ('admin_username','admin'),
  ('admin_password','admin123')
ON CONFLICT (k) DO NOTHING;

CREATE TABLE IF NOT EXISTS jt_clients (
  id            TEXT PRIMARY KEY,
  username      TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name          TEXT,
  company       TEXT,
  email         TEXT,
  phone         TEXT,
  client_code   TEXT
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
