import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function check() {
    const { data } = await supabase.from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (data && data[0]) {
        console.log(JSON.stringify(data[0], null, 2));
    } else {
        console.log('No log found.');
    }
}
check();
