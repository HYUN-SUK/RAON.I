import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function run() {
    const userId = 'f3e1e14c-423f-477a-b07b-4ebcb7951e86';
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayKstStr = new Date(today.getTime() + 9 * 3600000).toISOString().split('T')[0];
    console.log(`Today KST: ${todayKstStr}`);

    const { data: schedules, error: err1 } = await supabase
        .from('user_schedules')
        .select('id, check_in, check_out')
        .eq('user_id', userId)
        .lte('check_in', todayKstStr)
        .order('check_in', { ascending: false });

    if (err1) {
        console.error('Error fetching schedules:', err1);
        return;
    }

    console.log(`Matching schedules count: ${schedules.length}`);
    schedules.forEach(s => {
        console.log(`- ID: ${s.id}, CheckIn: ${s.check_in}, CheckOut: ${s.check_out}`);
    });

    if (schedules.length === 0) return;

    const scheduleIds = schedules.map(s => s.id);
    const { data: existingRecords, error: err2 } = await supabase
        .from('camping_records')
        .select('schedule_id')
        .eq('user_id', userId)
        .in('schedule_id', scheduleIds);

    if (err2) {
        console.error('Error fetching records:', err2);
        return;
    }

    console.log(`Staged records count: ${existingRecords.length}`);

    const writtenScheduleIds = new Set((existingRecords || []).map(r => r.schedule_id));
    const unwrittenScheduleIds = scheduleIds.filter(id => !writtenScheduleIds.has(id));

    console.log(`Unwritten Schedule IDs:`, unwrittenScheduleIds);
}

run();
