import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectSchedule() {
    const { data } = await supabase.from('user_schedules').select('*').eq('check_in', '2026-03-25');
    console.log(JSON.stringify(data, null, 2));
}

inspectSchedule();
