import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkOldLogs() {
    const { data: logs } = await supabase
        .from('notifications')
        .select('id, title, event_type, status, error_message, created_at, sent_at')
        .eq('status', 'sent')
        .gte('created_at', '2026-02-25T00:00:00+00:00')
        .lte('created_at', '2026-02-25T23:59:59+00:00')
        .order('created_at', { ascending: false })
        .limit(5);

    fs.writeFileSync('debug_old.json', JSON.stringify(logs, null, 2));
    console.log("Dumped to debug_old.json");
}

checkOldLogs();
