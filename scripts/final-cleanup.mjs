import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function superCleanup() {
    console.log('🔥 Starting Final Aggressive Cleanup...');
    let total = 0;

    // 1. Delete Legacy Sources
    while (true) {
        const { data, error } = await supabase.from('master_places').select('id').in('api_source', ['PRESTIGE_ENRICHMENT', 'REGIONAL_SCENERY']).limit(500);
        if (error) { console.error('Legacy Fetch Error:', error.message); break; }
        if (!data || data.length === 0) break;
        
        const { error: delError } = await supabase.from('master_places').delete().in('id', data.map(d => d.id));
        if (delError) { console.error('Legacy Delete Error:', delError.message); break; }
        
        total += data.length;
        console.log(`  -> Deleted legacy: ${total}...`);
    }

    // 2. Delete Lat=0 Junk (Junk added during previous sync failures)
    let junkTotal = 0;
    while (true) {
        const { data, error } = await supabase.from('master_places').select('id').eq('api_source', 'TOUR_SPOT').eq('lat', 0).limit(500);
        if (error) { console.error('Junk Fetch Error:', error.message); break; }
        if (!data || data.length === 0) break;
        
        const { error: delError } = await supabase.from('master_places').delete().in('id', data.map(d => d.id));
        if (delError) { console.error('Junk Delete Error:', delError.message); break; }
        
        junkTotal += data.length;
        console.log(`  -> Deleted junk (lat=0): ${junkTotal}...`);
    }

    console.log(`✨ Cleanup Finished! Total Records Removed: ${total + junkTotal}`);
}

superCleanup();
