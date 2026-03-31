
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: 'c:/Users/USER/Desktop/RAON.I/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required env vars: SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditStep1() {
    console.log('--- [Step 1: Weekly Master Sync Audit (Extended Search)] ---');
    
    // Check logs from 2026-03-28 12:00:00 UTC onwards (covers 21:00 KST Saturday)
    const startTime = '2026-03-28T12:00:00Z';
    const { data: logs, error: logError } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .gte('created_at', startTime)
        .order('created_at', { ascending: false });

    if (logError) {
        console.error('Error fetching logs:', logError.message);
    } else if (!logs || logs.length === 0) {
        console.log(`❌ No MASTER_SYNC logs found since ${startTime}.`);
    } else {
        console.log(`✅ Found ${logs.length} MASTER_SYNC log(s) since ${startTime}.`);
        logs.forEach(log => {
            const kstDate = new Date(log.created_at).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' });
            console.log(`- Status: ${log.status}, Count: ${log.processed_count}, Time (KST): ${kstDate}, Message: ${log.message}`);
            if (log.api_status) {
                console.log('  API Status summary:');
                log.api_status.forEach(s => {
                    console.log(`    [${s.name}] Status: ${s.status}, Fetched: ${s.fetched_count}, Updated: ${s.updated_count}, New: ${s.new_count}`);
                });
            }
        });
    }

    // Exact API counts in master_places
    console.log('\n--- [Current master_places counts by api_source] ---');
    const sources = [
        'SMBA_BAEK', 'LOCALDATA_RESTAURANT', 'SAFE_RESTAURANT', 
        'LOCALDATA_MART_SSM', 'LOCALDATA_MART_LARGE', 'LOCALDATA_MART_SUPER',
        'TOUR_SPOT'
    ];

    for (const source of sources) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .ilike('api_source', `%${source}%`);
        
        if (error) {
            console.error(`Error counting ${source}:`, error.message);
        } else {
            console.log(`${source.padEnd(25)}: ${count}`);
        }
    }
}

auditStep1();
