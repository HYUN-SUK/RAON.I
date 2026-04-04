
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const targetSources = [
    'TOUR_SPOT', 'SMBA_BAEK', 'MOIS_GOOD_RESTAURANT', 'SAFE_RESTAURANT',
    'LOCALDATA_MART_LARGE', 'LOCALDATA_MART_SSM', 'LOCALDATA_MART_OTHER', 'LOCALDATA_MART_SUPER'
];

async function runAudit() {
    console.log('--- RAONAI Final Audit (Ground Zero) ---');
    for (const src of targetSources) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .eq('api_source', src);
        
        if (error) {
            console.log(`${src}: ERROR - ${error.message}`);
        } else {
            console.log(`${src}: ${count.toLocaleString()}`);
        }
    }
}

runAudit();
