
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkNotifications() {
    console.log('--- Checking Latest Notifications ---');

    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching notifications:', error);
        return;
    }

    if (!notifications || notifications.length === 0) {
        console.log('No notifications found.');
        return;
    }

    const latest = notifications[0];
    console.log(`\n=== LATEST NOTIFICATION ===`);
    console.log(`To: ${latest.user_id}`);
    console.log(`Status: ${latest.status}`);
    console.log(`Created (KST): ${new Date(latest.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
    console.log(`Result: ${latest.result || 'NULL'}`);
    console.log(`===========================\n`);
}

checkNotifications();
