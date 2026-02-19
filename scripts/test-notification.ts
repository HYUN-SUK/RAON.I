import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

async function runSimulation() {
    console.log('🚀 Starting Final Verification Simulation...');

    let targetUserId = 'c191ffa7-56e4-4be6-85b2-e5678dece820';
    console.log(`👤 Target User ID: ${targetUserId}`);

    const payload = {
        user_id: targetUserId,
        category: 'schedule',
        event_type: 'schedule_reminder',
        title: '[Final Test] Trigger Verification',
        body: 'If you see this being "sent", the system is 100% operational!',
        data: { route: '/myspace' },
        status: 'queued',
        quiet_hours_override: true
    };

    console.log('📥 Inserting notification with status "queued"...');
    const { data: inserted, error: insertError } = await supabase
        .from('notifications')
        .insert(payload)
        .select()
        .single();

    if (insertError) {
        console.error('❌ Insert failed:', JSON.stringify(insertError, null, 2));
        return;
    }

    console.log(`✅ Notification inserted. ID: ${inserted.id}`);
    console.log('⏳ Waiting for DB Trigger to fire (Max 40s)...');

    // Poll for status change
    let attempts = 0;
    const maxAttempts = 20; // 40 seconds total

    while (attempts < maxAttempts) {
        await new Promise(resolve => setTimeout(resolve, 2000));

        const { data: current } = await supabase
            .from('notifications')
            .select('status, result, error_message, sent_at')
            .eq('id', inserted.id)
            .single();

        if (current && current.status !== 'queued') {
            console.log(`\n🎉 Status changed to: ${current.status}`);
            console.log(`📝 Result: ${JSON.stringify(current.result)}`);
            console.log(`⏰ Sent At: ${current.sent_at}`);

            if (current.status === 'sent') {
                console.log('✅ SUCCESS: System is live and fully operational!');
            } else {
                console.log('⚠️ FAILED: Trigger fired but function reported error.');
                if (current.error_message) console.log(`❌ Error: ${current.error_message}`);
            }
            return;
        }

        process.stdout.write('.');
        attempts++;
    }

    console.log('\n❌ TIMEOUT: Status remained "queued". The trigger might still have issues or pg_net is delayed.');
}

runSimulation();
