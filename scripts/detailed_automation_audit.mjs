import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function runAudit() {
    console.log("=== RAONAI Automation Detailed Audit (2026-03-23) ===\n");

    // 1. Check MASTER_SYNC (Weekly Batch)
    console.log("--- 1. MASTER_SYNC Audit ---");
    const { data: syncLogs } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .order('created_at', { ascending: false })
        .limit(1);

    if (syncLogs && syncLogs.length > 0) {
        const log = syncLogs[0];
        console.log(`Job Date: ${log.created_at}`);
        console.log(`Status: ${log.status}`);
        console.log(`Duration: ${(log.duration_ms / 1000).toFixed(2)}s`);
        console.log(`Processed: ${log.processed_count}`);
        
        const details = JSON.parse(log.message || '{}');
        console.log(`Details: ${JSON.stringify(details, null, 2)}`);

        // If processed_count is 0, let's see why by looking at DB churn
        const { count } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .gte('created_at', '2026-03-22T15:00:00Z');
        
        const { count: updatedCount } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .gte('updated_at', '2026-03-22T15:00:00Z');

        console.log(`Actual DB Churn Today (KST): New=${count}, Updated=${updatedCount}`);
    }

    // 2. Check SMART_PLAN_CACHING (D-3 Caching)
    console.log("\n--- 2. SMART_PLAN_CACHING Audit ---");
    const { data: cachingLogs } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'SMART_PLAN_CACHING')
        .order('created_at', { ascending: false })
        .limit(1);

    if (cachingLogs && cachingLogs.length > 0) {
        const log = cachingLogs[0];
        const msg = JSON.parse(log.message || '{}');
        
        console.log(`Target Date: ${log.target_date}`);
        console.log(`Status: ${log.status}`);
        
        // Part 1: Dynamic Data Upsert (Step A)
        if (msg.clusters && msg.clusters[0]) {
            const stepA = msg.clusters[0].stepA_dynamic || {};
            console.log("\n[Part 1] Dynamic Data Raw Upsert (master_places):");
            Object.entries(stepA).forEach(([cat, count]) => {
                console.log(` - ${cat}: ${count} discovered/upserted`);
            });
        }

        // Part 2: Selection & Kakao Verification Funnel (Step B & C)
        if (msg.clusters && msg.clusters[0]) {
            const stepB = msg.clusters[0].stepB_filter || {};
            const stepC_att = msg.clusters[0].stepC_kakao_attempts;
            const stepC_suc = msg.clusters[0].stepC_kakao_success;
            
            console.log("\n[Part 2] Selection & Verification Funnel:");
            Object.entries(stepB).forEach(([cat, counts]) => {
                console.log(` - ${cat}: Discovered ${counts.discovered} -> Passed Formula ${counts.passed_formula}`);
            });
            console.log(`\n - Kakao Verification: ${stepC_att} attempts, ${stepC_suc} successful`);
            console.log(` - Final Upserted to smart_plan_facts: ${log.processed_count}`);
        }
    }
}

runAudit();
