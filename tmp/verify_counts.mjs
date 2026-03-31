import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function test() {
    console.log('--- Checking v11.3 Sync Results ---');
    
    const { data: log } = await supabase.from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (log && log[0]) {
        console.log('Latest Log ID:', log[0].id);
        console.log('Status:', log[0].status);
        console.log('API Status Highlights:');
        (log[0].api_status || []).forEach(api => {
            console.log(` - ${api.name}: Fetched=${api.fetched_count}, New=${api.new_count}, Updated=${api.updated_count}, Existing=${api.existing_count}`);
        });
    }

    const { count: largeCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('api_source', 'LOCALDATA_MART_LARGE');
    const { count: otherCount } = await supabase.from('master_places').select('*', { count: 'exact', head: true }).eq('api_source', 'LOCALDATA_MART_OTHER');
    
    console.log('\n--- DB Counts ---');
    console.log('LOCALDATA_MART_LARGE:', largeCount);
    console.log('LOCALDATA_MART_OTHER:', otherCount);
}

test();
