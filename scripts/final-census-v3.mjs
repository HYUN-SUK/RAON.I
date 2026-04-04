import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function finalAudit() {
    console.log('\n--- RAONAI Ground Zero Completion Audit (Paginated) ---');
    
    let allData = [];
    let from = 0;
    const step = 1000;

    while (true) {
        const { data, error } = await supabase
            .from('master_places')
            .select('api_source')
            .range(from, from + step - 1);
        
        if (error) { console.error('  [Error]', error.message); break; }
        if (!data || data.length === 0) break;
        
        allData = allData.concat(data);
        from += step;
        process.stdout.write(`\r  Fetching: ${allData.length}...`);
    }

    const census = allData.reduce((acc, curr) => {
        acc[curr.api_source] = (acc[curr.api_source] || 0) + 1;
        return acc;
    }, {});

    console.log('\n\n[Official Results]');
    Object.entries(census).sort((a,b) => b[1] - a[1]).forEach(([src, count]) => {
        console.log(`- ${src.padEnd(25)}: ${count.toLocaleString()} records`);
    });

    console.log(`\nTOTAL MASTER PLACES: ${allData.length.toLocaleString()}`);
}

finalAudit();
