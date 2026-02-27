import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLatestLogs() {
    const { data: logs, error: err } = await supabase
        .from('notifications')
        .select('id, title, event_type, status, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(5);

    if (err) {
        console.error("Error fetching logs:", err);
        return;
    }

    fs.writeFileSync('latest_push.json', JSON.stringify(logs, null, 2));
    console.log("Dumped 5 recent notifications to latest_push.json");
}

checkLatestLogs();
