-- Check Group Members
SELECT 
    gm.group_id, 
    gm.user_id, 
    gm.role, 
    u.email as user_email,
    u.id as user_table_id
FROM group_members gm
LEFT JOIN users u ON gm.user_id = u.id;

-- Check if any groups exist without members
SELECT id, name, owner_id FROM groups;
