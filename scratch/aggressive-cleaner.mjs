import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function aggressiveNameCleaner() {
    console.log('--- [Aggressive Name Cleaner] Nuclear option for prefixes ---');

    let totalCleaned = 0;
    let page = 0;

    while (true) {
        const { data: spots, error } = await supabase
            .from('master_places')
            .select('id, name')
            .eq('category', 'SPOT')
            .range(page * 1000, (page + 1) * 1000 - 1);

        if (error || !spots || spots.length === 0) break;

        const batch = [];
        for (const spot of spots) {
            // Remove everything before and including the last colon, OR common bracket prefixes
            let cleanName = spot.name;
            
            if (cleanName.includes(':')) {
                cleanName = cleanName.split(':').pop().trim();
            }
            
            cleanName = cleanName
                .replace(/\*\*.*?\*\*/g, '')
                .replace(/^\W+/, '') // Remove symbols at start
                .trim();

            if (cleanName !== spot.name && cleanName.length > 0) {
                batch.push({ id: spot.id, name: cleanName });
                totalCleaned++;
            }
        }

        if (batch.length > 0) {
            await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
        }

        process.stdout.write(`\rProcessed: ${(page + 1) * 1000} | Cleaned: ${totalCleaned}`);
        page++;
    }

    console.log(`\n\n✨ Aggressive Cleaning Completed. Total ${totalCleaned} names purified.`);
}

aggressiveNameCleaner().catch(console.error);
