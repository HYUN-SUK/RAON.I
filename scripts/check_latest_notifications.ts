
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) process.exit(1);

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function checkNotifications() {
    console.log("Fetching latest 10 notifications...");

    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching notifications:", error);
        return;
    }

    if (!notifications || notifications.length === 0) {
        console.log("No notifications found.");
        return;
    }

    const output = notifications.map(n => ({
        created_at: n.created_at,
        status: n.status,
        id: n.id,
        result: n.result,
        error: n.error_message
    }));
    fs.writeFileSync('latest_notifs.json', JSON.stringify(output, null, 2));
    console.log("Written to latest_notifs.json");
}

checkNotifications();
