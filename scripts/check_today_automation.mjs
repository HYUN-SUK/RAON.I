import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    let report = "=== 1. Automation Logs ===\n";
    const { data: logs, error: e1 } = await supabase
        .from('automation_logs')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);
    
    report += JSON.stringify(logs, null, 2) + "\n\n";

    report += "=== 2. master_places recent updates ===\n";
    const { data: mpData, error: e2 } = await supabase
        .from('master_places')
        .select('category, api_source, created_at')
        .gte('created_at', '2026-03-21T15:00:00Z') // After 00:00 KST
        .limit(1000);
    
    const mpCounts = (mpData || []).reduce((acc, row) => {
        acc[row.category] = (acc[row.category] || 0) + 1;
        return acc;
    }, {});
    report += "Master Places newly created/upserted today: " + JSON.stringify(mpCounts, null, 2) + "\n";
    if (e2) report += "MP Error: " + JSON.stringify(e2) + "\n";

    report += "\n=== 3. smart_plan_facts recent updates ===\n";
    const { data: spData, error: e3 } = await supabase
        .from('smart_plan_facts')
        .select('category, trust_score, name, api_source, created_at')
        .gte('created_at', '2026-03-21T15:00:00Z')
        .limit(500);
    
    const spCounts = (spData || []).reduce((acc, row) => {
        acc[row.category] = (acc[row.category] || 0) + 1;
        return acc;
    }, {});
    report += "Smart Plan Facts newly created/upserted today: " + JSON.stringify(spCounts, null, 2) + "\n";
    if (e3) report += "SP Error: " + JSON.stringify(e3) + "\n";
    report += "Sample Facts:\n" + JSON.stringify((spData || []).slice(0, 10), null, 2);

    fs.writeFileSync('audit_today.txt', report);
    console.log('Audit complete. Check audit_today.txt');
}

check();
