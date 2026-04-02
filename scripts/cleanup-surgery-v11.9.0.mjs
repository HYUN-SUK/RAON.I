import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function surgery() {
    console.log("Starting v11.9.0 Surgical Cleanup...");
    const startTime = '2026-04-02T05:21:00Z'; // 14:21 KST (Run #16 start)
    
    let totalDeleted = 0;
    while (true) {
        // Step 1: Fetch target IDs created today (faulty IDs for SAFE_RESTAURANT)
        const { data, error } = await supabase
            .from('master_places')
            .select('id')
            .eq('api_source', 'SAFE_RESTAURANT')
            .gte('created_at', startTime)
            .limit(100);
            
        if (error) { 
            console.error("Fetch Error:", error); 
            break; 
        }
        if (!data || data.length === 0) {
            console.log("No more duplicates found.");
            break;
        }
        
        const ids = data.map(d => d.id);
        
        // Step 2: Delete by IDs (Indexed field, very fast)
        const { error: delError } = await supabase
            .from('master_places')
            .delete()
            .in('id', ids);
            
        if (delError) {
            console.error("Delete Error:", delError);
            break;
        }
        
        totalDeleted += ids.length;
        console.log(`  [Surgery] Removed ${totalDeleted} records...`);
        
        // Safety delay to prevent DB stress
        await new Promise(r => setTimeout(r, 500));
    }
    
    console.log(`\nDone. Total ${totalDeleted} contaminated records purged.`);
}

surgery();
