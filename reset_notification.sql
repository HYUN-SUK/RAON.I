
UPDATE user_schedules 
SET notification_d1_sent = false 
WHERE id = 'a7f8184b-75da-4984-9264-678b6787eea8';

SELECT id, check_in, notification_d1_sent, status 
FROM user_schedules 
WHERE id = 'a7f8184b-75da-4984-9264-678b6787eea8';
