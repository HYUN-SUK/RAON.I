-- Add notification_record_reminder_sent column to user_schedules table to prevent duplicate record reminders
ALTER TABLE user_schedules ADD COLUMN IF NOT EXISTS notification_record_reminder_sent BOOLEAN DEFAULT false;
