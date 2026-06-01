import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log("=== START AUDIT ===");
    
    // 1. Get recent users with upcoming reservations to identify the USER's ID
    const { data: profiles, error: profileErr } = await supabase
        .from('profiles')
        .select('id, nickname, email')
        .limit(50);
        
    if (profileErr) {
        console.error("Profile fetch error:", profileErr);
        return;
    }
    
    // 2. Fetch notifications related to upcoming stays (D-4, D-1, Today) in the last 10 days
    const { data: notifications, error: notifErr } = await supabase
        .from('notifications')
        .select('id, user_id, title, event_type, status, error_message, created_at, sent_at')
        .in('event_type', ['upcoming_stay_d4', 'upcoming_stay_d1', 'upcoming_stay_today'])
        .order('created_at', { ascending: false })
        .limit(50);
        
    if (notifErr) {
        console.error("Notification fetch error:", notifErr);
        return;
    }
    
    console.log(`Found ${notifications.length} upcoming stay notifications in recent logs.`);
    
    // Map notifications to display nickname
    const auditLogs = notifications.map(n => {
        const user = profiles.find(p => p.id === n.user_id);
        return {
            id: n.id,
            nickname: user ? user.nickname : 'Unknown',
            email: user ? user.email : 'Unknown',
            userId: n.user_id,
            title: n.title,
            eventType: n.event_type,
            status: n.status,
            error: n.error_message,
            createdAt: n.created_at
        };
    });
    
    // 3. Dump the token details for active users in the notification logs
    const uniqueUserIds = [...new Set(notifications.map(n => n.user_id))];
    const userTokens = {};
    
    for (const uid of uniqueUserIds) {
        const { data: tokens } = await supabase
            .from('push_tokens')
            .select('token, device_type, is_active, created_at, last_updated_at')
            .eq('user_id', uid)
            .order('last_updated_at', { ascending: false });
            
        const user = profiles.find(p => p.id === uid);
        const name = user ? `${user.nickname} (${user.email})` : uid;
        userTokens[name] = tokens || [];
    }
    
    fs.writeFileSync('push_audit_result.json', JSON.stringify({
        auditLogs,
        userTokens
    }, null, 2));
    
    console.log("Audit complete. Saved to push_audit_result.json");
}

runAudit();
