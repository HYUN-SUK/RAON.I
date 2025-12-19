SELECT pg_get_constraintdef(oid) AS constraint_def
FROM pg_constraint
WHERE conname = 'posts_type_check';
