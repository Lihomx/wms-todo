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
