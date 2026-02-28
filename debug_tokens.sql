-- Check latest notifications and their tokens
SELECT 
    n.id, 
    n.created_at, 
    n.user_id, 
    n.event_type, 
    n.status, 
    n.error_message,
    (SELECT count(*) FROM push_tokens WHERE user_id = n.user_id) as token_count,
    p.token as used_token,
    p.last_updated_at as token_last_updated
FROM notifications n
LEFT JOIN push_tokens p ON n.user_id = p.user_id
WHERE n.created_at > now() - interval '2 days'
ORDER BY n.created_at DESC
LIMIT 20;

-- Check if any user has multiple active tokens
SELECT user_id, count(*), array_agg(last_updated_at)
FROM push_tokens
GROUP BY user_id
HAVING count(*) > 1;
