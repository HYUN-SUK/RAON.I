import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function finalAudit() {
    console.log('\n--- RAONAI Ground Zero Completion Audit ---');
    
    // Fetch all current sources for a full census
    const { data, error } = await supabase.from('master_places').select('api_source');
    if (error) { console.error('  [Error]', error.message); return; }

    const census = data.reduce((acc, curr) => {
        acc[curr.api_source] = (acc[curr.api_source] || 0) + 1;
        return acc;
    }, {});

    console.log('\n[Official Results]');
    Object.entries(census).sort((a,b) => b[1] - a[1]).forEach(([src, count]) => {
        console.log(`- ${src.padEnd(25)}: ${count.toLocaleString()} records`);
    });

    const total = data.length;
    console.log(`\nTOTAL MASTER PLACES: ${total.toLocaleString()}`);
}

finalAudit();
