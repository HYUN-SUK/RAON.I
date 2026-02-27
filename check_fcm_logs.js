import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ujscuubasstiqnpsjdfb.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; // Need the env var, or I'll just hardcode if needed, but the user has .env.local

import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    console.log("=== RECENT NOTIFICATIONS ===");
    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, event_type, status, error_message, created_at, sent_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error("Error fetching notifications:", error);
        return;
    }

    for (const notif of notifications) {
        console.log(`\n[${notif.created_at}] ${notif.title} (${notif.event_type})`);
        console.log(`Status: ${notif.status}`);
        if (notif.error_message) {
            console.log(`Error: ${notif.error_message}`);
        }

        // Check token for this user
        const { data: tokens } = await supabase
            .from('push_tokens')
            .select('token, is_active, updated_at')
            .eq('user_id', notif.user_id)
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(1);

        if (tokens && tokens.length > 0) {
            console.log(`Token active: Yes, updated at ${tokens[0].updated_at}`);
        } else {
            console.log(`Token active: NO ACTIVE TOKEN FOUND`);
        }
    }
}

checkLogs();
