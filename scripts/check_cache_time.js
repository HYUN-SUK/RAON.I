const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function checkCache() {
    console.log('--- Cache Update Time Analysis (Mar 1st) ---');

    // Check Weather Cache
    const { data: wCache } = await supabase
        .from('weather_cache')
        .select('nx, ny, updated_at')
        .order('updated_at', { ascending: false })
        .limit(10);
    console.log('\nRecent Weather Cache Updates:');
    console.table(wCache);

    // Check Nearby Events Cache
    const { data: nCache } = await supabase
        .from('nearby_cache')
        .select('region_code, base_date, created_at')
        .eq('base_date', '20260301')
        .order('created_at', { ascending: false });
    console.log('\nNearby Cache for Today:');
    console.table(nCache);

    // Check if any notifications were created by the cron (before my manual run)
    // My manual run was around 10:34 KST (01:34 UTC)
    const { data: earlyNotifs } = await supabase
        .from('notifications')
        .select('event_type, created_at')
        .gte('created_at', '2026-03-01T00:00:00Z')
        .lt('created_at', '2026-03-01T01:30:00Z') // Before 10:30 KST
        .order('created_at', { ascending: true });

    console.log('\nEarly Notifications (before 10:30 AM):');
    console.table(earlyNotifs);
}

checkCache();
