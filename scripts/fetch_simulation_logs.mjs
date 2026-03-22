import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectLogs() {
    console.log("Fetching the latest SMART_PLAN_CACHING log...");
    const { data } = await supabase.from('automation_logs')
        .select('*')
        .eq('job_name', 'SMART_PLAN_CACHING')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (data && data.length > 0) {
        console.log("Raw Log Record:\n", JSON.stringify(data[0], null, 2));
        try {
            const parsed = JSON.parse(data[0].message);
            console.log("\n--- Parsed Telemetry Message ---");
            console.log(JSON.stringify(parsed, null, 2));
            console.log("--------------------------------");
        } catch(e) { /* message not json */ }
    } else {
        console.log("No logs found.");
    }
}
inspectLogs();
