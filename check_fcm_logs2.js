import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase credentials in .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
    const { data: notifications, error } = await supabase
        .from('notifications')
        .select('id, user_id, title, event_type, status, error_message, created_at, sent_at')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        fs.writeFileSync('result.json', JSON.stringify({ error }));
        return;
    }

    const results = [];

    for (const notif of notifications) {
        const entry = {
            title: notif.title,
            event: notif.event_type,
            status: notif.status,
            error: notif.error_message,
            createdAt: notif.created_at,
            tokens: []
        };

        const { data: tokens } = await supabase
            .from('push_tokens')
            .select('token, is_active, updated_at')
            .eq('user_id', notif.user_id)
            .eq('is_active', true)
            .order('updated_at', { ascending: false })
            .limit(2);

        if (tokens) {
            entry.tokens = tokens;
        }
        results.push(entry);
    }

    fs.writeFileSync('result.json', JSON.stringify(results, null, 2));
}

checkLogs();
