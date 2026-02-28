const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function diagnose() {
    console.log('--- Gathering Data ---');
    const { data: profiles } = await supabase.from('profiles').select('id, email');
    const emailMap = {};
    profiles.forEach(p => emailMap[p.id] = p.email);

    const { data: notifications } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(30);

    const { data: allTokens } = await supabase
        .from('push_tokens')
        .select('*')
        .order('last_updated_at', { ascending: false });

    const report = {
        timestamp: new Date().toISOString(),
        recent_notifications: notifications.map(n => ({
            ...n,
            user_email: emailMap[n.user_id] || 'Unknown'
        })),
        token_stats: {},
        all_tokens: allTokens.map(t => ({
            ...t,
            user_email: emailMap[t.user_id] || 'Unknown'
        }))
    };

    allTokens.forEach(t => {
        const email = emailMap[t.user_id] || t.user_id;
        if (!report.token_stats[email]) report.token_stats[email] = 0;
        report.token_stats[email]++;
    });

    fs.writeFileSync('diag_result.json', JSON.stringify(report, null, 2));
    console.log('Results written to diag_result.json');
}

diagnose();
