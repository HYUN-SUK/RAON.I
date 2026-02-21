SELECT '--- CRON JOB RUN DETAILS ---' as section;
SELECT jobid, command, start_time, end_time, status, return_message 
FROM cron.job_run_details 
WHERE command LIKE '%camping-reminder%'
ORDER BY start_time DESC LIMIT 5;

SELECT '--- USER SCHEDULES ---' as section;
SELECT id, user_id, check_in, campground_name, notification_d0_sent, notification_d1_sent, notification_d4_sent 
FROM user_schedules 
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'tootg@naver.com');

SELECT '--- NOTIFICATIONS ---' as section;
SELECT id, event_type, status, created_at, result 
FROM notifications 
WHERE user_id IN (SELECT id FROM auth.users WHERE email = 'tootg@naver.com')
ORDER BY created_at DESC LIMIT 5;
