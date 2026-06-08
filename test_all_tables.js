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
    console.log(`Starting deep DB investigation for user ID: ${targetUserId}...`);

    const tablesToCheck = [
        { name: 'open_day_rules', cols: ['user_id', 'created_by'] },
        { name: 'weather_cache', cols: ['user_id'] },
        { name: 'sites', cols: ['user_id'] },
        { name: 'blocked_dates', cols: ['user_id'] },
        { name: 'push_tokens', cols: ['user_id'] },
        { name: 'notifications', cols: ['user_id'] },
        { name: 'system_config', cols: ['user_id'] },
        { name: 'operation_logs', cols: ['user_id', 'operator_id'] },
        { name: 'in_app_badges', cols: ['user_id'] },
        { name: 'waitlist', cols: ['user_id'] },
        { name: 'ember_supports', cols: ['user_id', 'sender_id', 'receiver_id'] },
        { name: 'mission_rewards', cols: ['user_id'] },
        { name: 'reservations', cols: ['user_id'] },
        { name: 'user_permission_consents', cols: ['user_id'] },
        { name: 'campgrounds', cols: ['user_id'] },
        { name: 'user_camping_modes', cols: ['user_id'] },
        { name: 'user_plan_locks', cols: ['user_id'] },
        { name: 'user_favorites', cols: ['user_id'] },
        { name: 'user_camping_schedules', cols: ['user_id'] },
        { name: 'record_tags', cols: ['user_id'] },
        { name: 'campground_user_tags', cols: ['user_id'] },
        { name: 'user_schedules', cols: ['user_id'] },
        { name: 'schedule_checklists', cols: ['user_id'] },
        { name: 'campground_favorites', cols: ['user_id'] },
        { name: 'camping_records', cols: ['user_id'] },
        { name: 'groups', cols: ['owner_id'] },
        { name: 'group_members', cols: ['user_id'] },
        { name: 'nearby_cache', cols: ['user_id'] },
        { name: 'cached_facilities', cols: ['user_id'] },
        { name: 'user_personas', cols: ['user_id'] },
        { name: 'smart_plan_facts', cols: ['user_id'] },
        { name: 'automation_logs', cols: ['user_id'] },
        { name: 'user_camping_profiles', cols: ['user_id'] },
        { name: 'user_action_log', cols: ['user_id'] },
        { name: 'user_tag_ledger', cols: ['user_id'] },
        { name: 'user_persona_snapshots', cols: ['user_id'] },
        { name: 'trip_persona_snapshots', cols: ['user_id'] },
        { name: 'user_campground_hearts', cols: ['user_id'] },
        { name: 'prestige_landmarks', cols: ['user_id'] },
        { name: 'smart_plan_candidates', cols: ['user_id'] },
        { name: 'withdrawn_user_records', cols: ['user_id'] },
        { name: 'posts', cols: ['author_id'] },
        { name: 'comments', cols: ['author_id'] },
        { name: 'likes', cols: ['user_id'] },
        { name: 'orders', cols: ['user_id'] },
        { name: 'cart_items', cols: ['user_id'] },
        { name: 'products', cols: ['user_id'] }
    ];

    for (const t of tablesToCheck) {
        for (const col of t.cols) {
            try {
                const { data, error } = await supabase
                    .from(t.name)
                    .select(col)
                    .eq(col, targetUserId);

                if (!error && data && data.length > 0) {
                    console.log(`[FOUND] Table: ${t.name}, Column: ${col} contains ${data.length} row(s) for this user.`);
                }
            } catch (e) {
                // Ignore error if column/table doesn't exist
            }
        }
    }
    console.log("Deep DB investigation complete.");
}

run();
