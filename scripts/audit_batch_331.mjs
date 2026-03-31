import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runAudit() {
    console.log("=== [SOP Phase 1] Weekly Master Sync Audit ===");
    
    // Period: From 3/30 15:00 UTC (3/31 00:00 KST) to now.
    const since = '2026-03-30T15:00:00Z';
    
    // 1. Fetch MASTER_SYNC log
    const { data: logs, error: lErr } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .gte('created_at', since)
        .order('created_at', { ascending: false });

    if (lErr) {
        console.error("Error fetching logs:", lErr);
        return;
    }

    if (!logs || logs.length === 0) {
        console.warn("No MASTER_SYNC log found for today (3/31). This may indicate the job did not run or failed silently.");
        // Try searching for yesterday's late log just in case
        const yesterdaySince = '2026-03-29T15:00:00Z';
        const { data: yLogs } = await supabase
            .from('automation_logs')
            .select('*')
            .eq('job_name', 'MASTER_SYNC')
            .gte('created_at', yesterdaySince)
            .order('created_at', { ascending: false });
        
        if (yLogs && yLogs.length > 0) {
            console.log("\nFound recent MASTER_SYNC log (3/30):");
            yLogs.forEach(l => {
                console.log(`- Time: ${l.created_at}, Status: ${l.status}, Processed: ${l.processed_count}, Message: ${l.message}`);
            });
        }
    } else {
        console.log(`\nDetected ${logs.length} MASTER_SYNC logs today:`);
        logs.forEach(l => {
            console.log(`- Time: ${l.created_at}, Status: ${l.status}, Processed: ${l.processed_count}`);
            console.log(`- Message: ${l.message}`);
        });
    }

    // 2. Aggregate counts by api_source for today's updates in master_places
    console.log("\nQuerying updated master_places counts by source (since 3/31 00:00 KST)...");
    const { data: records, error: rErr } = await supabase
        .from('master_places')
        .select('api_source, category')
        .gte('updated_at', since);

    if (rErr) console.error("Error fetching records:", rErr);

    const counts = {};
    (records || []).forEach(r => {
        const key = `${r.category}:${r.api_source}`;
        counts[key] = (counts[key] || 0) + 1;
    });

    console.log("\nDetailed Record Counts (Updated Today):");
    Object.entries(counts).forEach(([k, v]) => {
        console.log(`| ${k} | ${v} |`);
    });

    // 3. Final Stored Counts (Today's Result)
    console.log("\nFinal Total Stored Counts by Core Source:");
    const sources = [
        'SMBA_BAEK', 'MOIS_GOOD_RESTAURANT', 'SAFE_REST',
        'LOCALDATA_MART_LARGE', 'LOCALDATA_MART_SSM', 'LOCALDATA_MART_OTHER',
        'TOUR_SPOT'
    ];
    for (const src of sources) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .eq('api_source', src);
        console.log(`- ${src}: ${count || 0}`);
    }
}

runAudit();
