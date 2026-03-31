import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
    process.exit(1);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log("=== RAONAI 3/31 Precision Audit Start ===");
    
    // KST 3/31 00:00 is UTC 3/30 15:00
    const since = '2026-03-30T15:00:00Z';
    
    // 1. Weekly Batch (master_places)
    console.log("\n1. Weekly Batch (master_places) Audit...");
    const { data: masterGrouped, error: mgErr } = await supabase
        .from('master_places')
        .select('api_source, category')
        .gte('updated_at', since);
    
    const masterCounts = {};
    (masterGrouped || []).forEach(r => {
        const key = `${r.category}:${r.api_source}`;
        masterCounts[key] = (masterCounts[key] || 0) + 1;
    });

    // 2. D-3 Caching Part 1 & 2 (smart_plan_facts)
    console.log("\n2. D-3 Caching (smart_plan_facts) Audit...");
    const { data: factsGrouped, error: fgErr } = await supabase
        .from('smart_plan_facts')
        .select('api_source, category')
        .gte('updated_at', since);

    const factsCounts = {};
    (factsGrouped || []).forEach(r => {
        const key = `${r.category}:${r.api_source}`;
        factsCounts[key] = (factsCounts[key] || 0) + 1;
    });

    // 3. Automation Logs
    console.log("\n3. Automation Logs...");
    const { data: logs, error: logsErr } = await supabase
        .from('automation_logs')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

    // 4. Target Bookings for D-3 (Today is 3/31, so D-3 target is 4/3)
    const targetDate = '2026-04-03';
    const { count: resCount, error: resErr } = await supabase
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('check_in_date', targetDate)
        .neq('status', 'CANCELLED');

    const auditResults = {
        master_places_counts: masterCounts,
        smart_plan_facts_counts: factsCounts,
        logs: logs || [],
        target_reservations: { date: targetDate, count: resCount || 0 }
    };

    fs.writeFileSync('audit_results_331.json', JSON.stringify(auditResults, null, 2));
    console.log("\nAudit results saved to audit_results_331.json");
    
    // Print summary
    console.log("\n--- Audit Summary ---");
    console.log(`Target Reservations (4/3): ${resCount}`);
    console.log("\nMaster Places Updates:");
    Object.entries(masterCounts).forEach(([k, v]) => console.log(`- ${k}: ${v}`));
    console.log("\nSmart Plan Facts Updates:");
    Object.entries(factsCounts).forEach(([k, v]) => console.log(`- ${k}: ${v}`));
}

runAudit();
