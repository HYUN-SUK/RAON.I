-- Remove the old pg_cron job as it is replaced by GitHub Actions
SELECT cron.unschedule('invoke-camping-reminder');
