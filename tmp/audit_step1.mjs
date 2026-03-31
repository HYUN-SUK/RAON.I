
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: 'c:/Users/USER/Desktop/RAON.I/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditStep1() {
    process.env.DEBUG = '*';
    console.log('--- [Step 1: Weekly Master Sync Audit] ---');
    
    // 1. Check automation_logs for today's MASTER_SYNC
    const todayStr = new Date().toISOString().split('T')[0];
    const { data: logs, error: logError } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .gte('created_at', todayStr + 'T00:00:00Z')
        .order('created_at', { ascending: false });

    if (logError) {
        console.error('Error fetching logs:', logError.message);
    } else if (logs === null || logs.length === 0) {
        console.log(`❌ No MASTER_SYNC logs found for today (${todayStr}).`);
    } else {
        console.log(`✅ Found ${logs.length} MASTER_SYNC log(s) for today.`);
        logs.forEach(log => {
            console.log(`- Status: ${log.status}, Count: ${log.processed_count}, Time: ${log.created_at}, Message: ${log.message}`);
        });
    }

    // 2. Exact API counts in master_places
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
