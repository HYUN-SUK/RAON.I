-- ═══════════════════════════════════════════════════════════
-- Fix Camping Records Schema & Cache
-- ═══════════════════════════════════════════════════════════

-- 1. Ensure all new columns exist (Idempotent)
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS is_public BOOLEAN DEFAULT FALSE;
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS campground_type TEXT DEFAULT 'external';
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS campground_name TEXT;
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS campground_address TEXT;
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS latitude DOUBLE PRECISION;
ALTER TABLE camping_records ADD COLUMN IF NOT EXISTS longitude DOUBLE PRECISION;

-- 2. Force PostgREST Schema Cache Reload
-- This is necessary to make Supabase API recognize the new columns immediately.
NOTIFY pgrst, 'reload schema';
