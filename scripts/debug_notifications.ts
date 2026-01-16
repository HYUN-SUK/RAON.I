
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

    for (const n of notifications) {
        console.log(`\n[ID: ${n.id}]`);
        console.log(`  To User: ${n.user_id}`);
        console.log(`  Type: ${n.event_type} | Category: ${n.category}`);
        console.log(`  Title: ${n.title}`);
        console.log(`  Status: ${n.status}`);
        console.log(`  Created: ${n.created_at}`);
        console.log(`  Result: ${n.result || 'NULL'}`); // This contains the FCM response
    }
}

checkNotifications();
