import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNotifications() {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(3);

    if (error || !data || data.length === 0) {
        console.log('No notifications found or error:', error);
        return;
    }

    console.log('\n=== LATEST 3 NOTIFICATIONS ===');
    data.forEach((n, i) => {
        console.log(`\n[${i + 1}] ID: ${n.id.slice(0, 8)}...`);
        console.log(`    Status: ${n.status}`);
        console.log(`    Event: ${n.event_type}`);
        console.log(`    Created: ${new Date(n.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
        console.log(`    Sent At: ${n.sent_at || 'NULL'}`);
        console.log(`    Result: ${n.result || 'NULL'}`);
    });
    console.log('\n==============================\n');
}

checkNotifications();
