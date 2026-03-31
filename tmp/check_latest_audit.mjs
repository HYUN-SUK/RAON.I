import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkLogs() {
    const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('category', 'MASTER_SYNC')
        .order('created_at', { ascending: false })
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    if (data && data.length > 0) {
        console.log(JSON.stringify(data[0].api_status, null, 2));
    } else {
        console.log("No logs found");
    }
}

checkLogs();
