const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

async function checkSchedules() {
    const { data: schedules } = await supabase.from('user_schedules').select('*');
    if (schedules) {
        console.log('--- User Schedules ---');
        schedules.forEach(s => {
            console.log(`ID: ${s.id}, Name: ${s.campground_name}, Lat: ${s.campground_lat}, Lng: ${s.campground_lng}`);
        });
    }
}

checkSchedules();
