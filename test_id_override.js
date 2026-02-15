
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testIdOverride() {
    let output = "";
    try {
        output += "Attempting to insert with explicit ID...\n";

        // 1. Get a valid user_id
        const { data: user } = await supabase.from('user_schedules').select('user_id').limit(1).single();
        const userId = user?.user_id;

        if (!userId) {
            console.log("No user found.");
            return;
        }

        const explicitId = '11111111-2222-3333-4444-555555555555';

        const n = {
            id: explicitId,
            user_id: userId,
            category: 'schedule',
            event_type: 'schedule_reminder',
            title: 'ID Override Test',
            body: 'Testing explicit ID',
            data: { route: '/test' },
            is_read: false
        };

        const { data, error } = await supabase.from('notifications').insert(n);

        if (error) {
            output += `Override Failed: ${error.message} (Code: ${error.code})\n`;
        } else {
            output += `Override SUCCEEDED! ID: ${explicitId}\n`;
        }

    } catch (e) {
        output += `Script Error: ${e.message}\n`;
    } finally {
        fs.writeFileSync('id_override_log.txt', output, 'utf8');
        console.log("Log saved to id_override_log.txt");
    }
}

testIdOverride();
