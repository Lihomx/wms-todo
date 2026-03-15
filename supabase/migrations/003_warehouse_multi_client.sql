-- ============================================================
-- Migration 003: Warehouse manages multiple OMS clients
-- Architecture: One warehouse AppKey, multiple customer codes
-- ============================================================

-- Add customer_code to todos (to separate data per OMS client)
ALTER TABLE todos ADD COLUMN IF NOT EXISTS customer_code TEXT;
CREATE INDEX IF NOT EXISTS idx_todos_customer_code ON todos(customer_code);

-- Add customer_code to lingxing_credentials sync tracking
ALTER TABLE lingxing_credentials ADD COLUMN IF NOT EXISTS last_sync_customer TEXT;

-- Update oms_clients to track sync status per client
ALTER TABLE oms_clients ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMPTZ;
ALTER TABLE oms_clients ADD COLUMN IF NOT EXISTS todo_count INTEGER DEFAULT 0;

-- Add customer_code filter to user_profiles (warehouse staff can be assigned to specific clients)
ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS assigned_customer_codes TEXT[] DEFAULT '{}';
-- empty array = can see all clients (warehouse_admin)
-- specific codes = only those clients

-- View: todos with customer info (for warehouse dashboard)
CREATE OR REPLACE VIEW todos_with_client AS
SELECT 
  t.*,
  c.customer_name,
  c.oms_account,
  c.company_name
FROM todos t
LEFT JOIN oms_clients c ON c.customer_code = t.customer_code;
