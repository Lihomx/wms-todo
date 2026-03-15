-- ============================================================
-- Migration 004: Per-client OMS credentials
-- Each OMS client has their own AppKey/AppSecret
-- ============================================================

-- Add credentials to oms_clients table
ALTER TABLE oms_clients ADD COLUMN IF NOT EXISTS app_key TEXT;
ALTER TABLE oms_clients ADD COLUMN IF NOT EXISTS app_secret TEXT;
ALTER TABLE oms_clients ADD COLUMN IF NOT EXISTS auth_status INTEGER DEFAULT 0;
-- 0=未绑定, 1=已绑定, 2=验证失败
ALTER TABLE oms_clients ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE oms_clients ADD COLUMN IF NOT EXISTS sync_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE oms_clients ADD COLUMN IF NOT EXISTS warehouse_ids TEXT[] DEFAULT '{}';

-- Insert the known client (5629030 = current user)
-- The actual AppKey/AppSecret will be set via the admin UI
INSERT INTO oms_clients (customer_code, customer_name, oms_account, status)
VALUES ('5629030', 'A50 JOEY', 'A50-JOEY01', 'active')
ON CONFLICT (customer_code) DO UPDATE SET customer_name=EXCLUDED.customer_name;
