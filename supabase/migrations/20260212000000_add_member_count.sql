
-- Add member_count to user_schedules
ALTER TABLE user_schedules ADD COLUMN IF NOT EXISTS member_count INTEGER DEFAULT 2;
NOTIFY pgrst, 'reload schema';
