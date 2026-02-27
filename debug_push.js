import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTokensAndLogs() {
    const { data: logs } = await supabase
        .from('notifications')
        .select('id, title, event_type, status, error_message, created_at')
        .order('created_at', { ascending: false })
        .limit(3);

    const { data: tokens } = await supabase
        .from('push_tokens')
        .select('token, user_id, device_type, is_active, created_at, last_updated_at')
        .order('last_updated_at', { ascending: false })
        .limit(10);

    fs.writeFileSync('debug_out.json', JSON.stringify({ logs, tokens }, null, 2));
    console.log("Dumped to debug_out.json");
}

checkTokensAndLogs();
