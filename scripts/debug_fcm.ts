import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) { process.exit(1); }

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkFCMTokens() {
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
    console.log(`\nChecking FCM Token for user: ${userId}`);

    // Check profiles table for FCM token
    const { data: profile, error } = await supabase
        .from('profiles')
        .select('id, fcm_token, notification_enabled')
        .eq('id', userId)
        .single();

    if (error) {
        console.log('Profile fetch error:', error.message);
        return;
    }

    console.log('\n=== USER PROFILE ===');
    console.log(`ID: ${profile?.id}`);
    console.log(`FCM Token: ${profile?.fcm_token ? profile.fcm_token.slice(0, 20) + '...' : 'NULL/MISSING'}`);
    console.log(`Notifications Enabled: ${profile?.notification_enabled}`);
    console.log('====================\n');
}

checkFCMTokens();
