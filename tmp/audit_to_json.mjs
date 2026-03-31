
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: 'c:/Users/USER/Desktop/RAON.I/.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function auditStep1() {
    const startTime = '2026-03-28T12:00:00Z';
    const { data: logs } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .gte('created_at', startTime)
        .order('created_at', { ascending: false });

    const results = {
        logs: logs || [],
        counts: {}
    };

    const sources = [
        'SMBA_BAEK', 'LOCALDATA_RESTAURANT', 'SAFE_RESTAURANT', 
        'LOCALDATA_MART_SSM', 'LOCALDATA_MART_LARGE', 'LOCALDATA_MART_SUPER',
        'TOUR_SPOT'
    ];

    for (const source of sources) {
        const { count } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .ilike('api_source', `%${source}%`);
        results.counts[source] = count;
    }

    fs.writeFileSync('c:/Users/USER/Desktop/RAON.I/tmp/audit_json.json', JSON.stringify(results, null, 2));
    console.log('Audit results written to tmp/audit_json.json');
}

auditStep1();
