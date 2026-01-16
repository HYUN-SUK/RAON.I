import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPushTokens() {
    // Get latest notification to find user_id
    const { data: notifications } = await supabase
        .from('notifications')
        .select('user_id')
        .order('created_at', { ascending: false })
        .limit(1);

    if (!notifications || notifications.length === 0) {
        console.log('No notifications found');
        return;
    }

    const userId = notifications[0].user_id;
    console.log(`\nChecking push_tokens for user: ${userId}`);

    // Check push_tokens table
    const { data: tokens, error } = await supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', userId);

    if (error) {
        console.log('push_tokens fetch error:', error.message);
        return;
    }

    if (!tokens || tokens.length === 0) {
        console.log('\n>>> NO FCM TOKEN REGISTERED <<<');
        console.log('User needs to grant notification permission on their device first.\n');
        return;
    }

    console.log('\n=== PUSH TOKENS ===');
    tokens.forEach(t => {
        console.log(`Token: ${t.token?.slice(0, 30)}...`);
        console.log(`Active: ${t.is_active}`);
        console.log(`Updated: ${t.last_updated_at}`);
    });
    console.log('===================\n');
}

checkPushTokens();
