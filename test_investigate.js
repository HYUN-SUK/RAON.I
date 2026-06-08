const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing ENV keys");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
    const targetUserId = '4730be31-30b5-4594-a993-d8f5a7a5e26c'; // tootg@naver.com UUID
    console.log(`Re-investigating DB for user ID: ${targetUserId}...`);

    const tablesToCheck = [
        { name: 'posts', columns: ['author_id', 'group_id'] },
        { name: 'comments', columns: ['author_id', 'post_id'] },
        { name: 'likes', columns: ['user_id', 'post_id'] },
        { name: 'profiles', columns: ['id'] },
        { name: 'orders', columns: ['user_id'] },
        { name: 'cart_items', columns: ['user_id'] },
        { name: 'reservations', columns: ['user_id'] },
        { name: 'user_schedules', columns: ['user_id'] },
        { name: 'user_personas', columns: ['user_id'] },
        { name: 'user_camping_profiles', columns: ['user_id'] },
        { name: 'user_campground_hearts', columns: ['user_id'] },
        { name: 'user_missions', columns: ['user_id'] },
        { name: 'point_history', columns: ['user_id'] },
        { name: 'notifications', columns: ['user_id'] },
        { name: 'push_tokens', columns: ['user_id'] },
        { name: 'in_app_badges', columns: ['user_id'] },
        { name: 'waitlist', columns: ['user_id'] },
        { name: 'user_permission_consents', columns: ['user_id'] },
        { name: 'groups', columns: ['owner_id'] },
        { name: 'group_members', columns: ['user_id'] },
        { name: 'withdrawn_user_records', columns: ['user_id'] },
        { name: 'camping_records', columns: ['user_id'] },
        { name: 'user_action_log', columns: ['user_id'] }
    ];

    for (const table of tablesToCheck) {
        try {
            for (const col of table.columns) {
                const { data, error } = await supabase
                    .from(table.name)
                    .select(col)
                    .eq(col, targetUserId);

                if (error) {
                    if (!error.message.includes("does not exist") && !error.message.includes("column")) {
                        console.error(`Error querying ${table.name}.${col}:`, error.message);
                    }
                } else if (data && data.length > 0) {
                    console.log(`[FOUND] Table: ${table.name}, Column: ${col} contains ${data.length} row(s) for this user.`);
                }
            }
        } catch (e) {
            // Ignore error
        }
    }
    console.log("Re-investigation complete.");
}

run();
