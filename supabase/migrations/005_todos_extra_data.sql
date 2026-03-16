-- Add extra_data column to store rich OMS data per order
ALTER TABLE todos ADD COLUMN IF NOT EXISTS extra_data JSONB DEFAULT '{}';
CREATE INDEX IF NOT EXISTS idx_todos_extra_data ON todos USING gin(extra_data);
NOTIFY pgrst, 'reload schema';
