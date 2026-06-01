import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as fs from 'fs';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log("=== RESERVATION AND SCHEDULE AUDIT FOR USER: tootg ===");
    
    // User ID for tootg: 4730be31-30b5-4594-a993-d8f5a7a5e26c
    const userId = "4730be31-30b5-4594-a993-d8f5a7a5e26c";
    
    const { data: schedules, error: schedErr } = await supabase
        .from('user_schedules')
        .select('id, campground_name, check_in, check_out, source, status, notification_d4_sent, notification_d1_sent, notification_d0_sent, created_at')
        .eq('user_id', userId)
        .order('check_in', { ascending: false });
        
    if (schedErr) {
        console.error("Schedules fetch error:", schedErr);
        return;
    }
    
    console.log(`Found ${schedules.length} schedules/reservations for user 'tootg'.`);
    
    fs.writeFileSync('tootg_schedules.json', JSON.stringify(schedules, null, 2));
    console.log("Details dumped to tootg_schedules.json");
}

runAudit();
