import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function nationalNameCleaner() {
    console.log('--- [National Name Cleaner] Cleaning up Master DB Prefixes ---');

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
            // Regex to remove **Bold Prefix:** or (8-Scenery): prefixes
            const cleanName = spot.name
                .replace(/\*\*.*?\*\*[:]?\s*/g, '') // Remove **bold** stuff
                .replace(/\(.*?\d+경\)\s*[:]?\s*/g, '') // Remove (XX 8경): stuff
                .trim();

            if (cleanName !== spot.name) {
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

    console.log(`\n\n✨ National Name Cleaning Completed. Total ${totalCleaned} names simplified.`);
}

nationalNameCleaner().catch(console.error);
