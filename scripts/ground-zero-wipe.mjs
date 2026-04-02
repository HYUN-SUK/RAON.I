import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function wipeOut() {
    console.log("Starting Ground Zero Wipeout for v11.9.1...");
    const sources = ['SAFE_RESTAURANT', 'SPOT', 'BAEK', 'LOCALDATA', 'FESTIVAL', 'GAS_STATION'];
    
    for (const source of sources) {
        console.log(`  -> Purging source: ${source}...`);
        let deletedCount = 0;
        while (true) {
            const { data, error: fetchErr } = await supabase
                .from('master_places')
                .select('id')
                .eq('api_source', source)
                .limit(1000);
            
            if (fetchErr) { console.error(`Fetch Error (${source}):`, fetchErr); break; }
            if (!data || data.length === 0) break;
            
            const ids = data.map(d => d.id);
            const { error: delErr } = await supabase
                .from('master_places')
                .delete()
                .in('id', ids);
            
            if (delErr) { console.error(`Delete Error (${source}):`, delErr); break; }
            deletedCount += ids.length;
            process.stdout.write(`    Deleted ${deletedCount} items...\r`);
            await new Promise(r => setTimeout(r, 300));
        }
        console.log(`\n  Purged ${source} complete.`);
    }
    
    // Final check for any orphans
    console.log("Checking for any remaining records...");
    const { count } = await supabase.from('master_places').select('id', { count: 'exact', head: true });
    console.log(`FINAL COUNT: ${count} items left.`);
}

wipeOut();
