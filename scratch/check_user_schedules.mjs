import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const userId = 'f3e1e14c-423f-477a-b07b-4ebcb7951e86';
    console.log(`Checking schedules for user: ${userId}`);

    // 1. user_schedules 전체 조회
    const { data: schedules, error: err1 } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('user_id', userId);
    
    if (err1) {
        console.error('Error fetching schedules:', err1);
        return;
    }

    console.log(`Total schedules found: ${schedules.length}`);
    schedules.forEach(s => {
        console.log(`- ID: ${s.id}, Name: ${s.campground_name}, CheckIn: ${s.check_in}, CheckOut: ${s.check_out}, Status: ${s.status}`);
    });

    // 2. camping_records 전체 조회
    const { data: records, error: err2 } = await supabase
        .from('camping_records')
        .select('*')
        .eq('user_id', userId);
        
    if (err2) {
        console.error('Error fetching records:', err2);
        return;
    }

    console.log(`Total records found: ${records.length}`);
    records.forEach(r => {
        console.log(`- ID: ${r.id}, ScheduleID: ${r.schedule_id}, Title: ${r.title}`);
    });
}

run();
