
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFlags() {
    try {
        const { data, error } = await supabase
            .from('user_schedules')
            .select('id, check_in, status, notification_d0_sent, notification_d1_sent, notification_d4_sent, campground_name')
            .like('campground_name', '[TEST]%')
            .order('check_in', { ascending: true });

        if (error) {
            console.error(error);
            return;
        }

        console.log("Test Schedules Flags:");
        data.forEach(s => {
            console.log(`[${s.campground_name}] Check-in: ${s.check_in}`);
            console.log(`  D0 Sent: ${s.notification_d0_sent}`);
            console.log(`  D1 Sent: ${s.notification_d1_sent}`);
            console.log(`  D4 Sent: ${s.notification_d4_sent}`);
        });

    } catch (e) {
        console.error(e);
    }
}

checkFlags();
