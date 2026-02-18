SELECT id, email FROM profiles WHERE email = 'tootg@naver.com';
SELECT id, user_id, campground_name, check_in, created_at FROM user_schedules WHERE user_id IN (SELECT id FROM profiles WHERE email = 'tootg@naver.com') ORDER BY created_at DESC;
SELECT id, user_id, title, body, status, created_at FROM notifications WHERE user_id IN (SELECT id FROM profiles WHERE email = 'tootg@naver.com') ORDER BY created_at DESC LIMIT 10;
