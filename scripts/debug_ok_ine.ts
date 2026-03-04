import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY!
);

async function findUser() {
    console.log('--- Finding User ---');
    const { data: profiles, error: pError } = await supabase
        .from('profiles')
        .select('id, nickname, full_name')
        .or('nickname.ilike.%옥이네%,full_name.ilike.%옥이네%');

    if (pError) console.error('Profile Error:', pError);
    console.log('Profiles:', profiles);

    if (profiles && profiles.length > 0) {
        const userId = profiles[0].id;
        console.log(`\n--- Schedules for User ID: ${userId} ---`);
        const { data: schedules, error: sError } = await supabase
            .from('user_schedules')
            .select('*')
            .eq('user_id', userId)
            .order('check_in', { ascending: false });

        if (sError) console.error('Schedule Error:', sError);
        console.log('Schedules:', schedules);

        console.log(`\n--- Notifications for User ID: ${userId} ---`);
        const { data: notifs, error: nError } = await supabase
            .from('notifications')
            .select('*')
            .eq('user_id', userId)
            .order('created_at', { ascending: false })
            .limit(10);

        if (nError) console.error('Notification Error:', nError);
        console.log('Notifications:', notifs);
    }
}

findUser();
