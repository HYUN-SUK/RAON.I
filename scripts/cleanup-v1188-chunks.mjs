import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function cleanup() {
    console.log("Starting chunked cleanup for v11.8.8 duplicates...");
    let deletedCount = 0;
    while (true) {
        const { data, error } = await supabase
            .from('master_places')
            .select('id')
            .gte('created_at', '2026-04-02T05:21:00Z')
            .limit(100);
            
        if (error) { console.error("Fetch Error Details:", JSON.stringify(error, null, 2)); break; }
        if (!data || data.length === 0) break;
        
        const ids = data.map(d => d.id);
        const { error: delError } = await supabase
            .from('master_places')
            .delete()
            .in('id', ids);
            
        if (delError) { console.error("Delete Error:", delError); break; }
        deletedCount += ids.length;
        console.log(`  -> Deleted ${deletedCount} duplicates...`);
    }
    console.log("Done. Cleanup complete.");
}

cleanup();
