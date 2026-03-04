const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function dump() {
    const today = '2026-03-01';

    // 1. Find the user first
    const { data: profiles } = await supabase
        .from('profiles')
        .select('id, nickname')
        .or('nickname.ilike.%옥이네%');

    // 2. All notifications today
    const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .gte('created_at', today)
        .order('created_at', { ascending: false });

    // 3. All schedules with check_in on or after today
    const { data: schedules } = await supabase
        .from('user_schedules')
        .select('*')
        .gte('check_in', today)
        .order('check_in', { ascending: true });

    const result = {
        profiles: profiles || [],
        notifications_today: notifs || [],
        upcoming_schedules: schedules || []
    };

    fs.writeFileSync('debug_dump.json', JSON.stringify(result, null, 2));
    console.log('Dump complete to debug_dump.json');
}

dump();
