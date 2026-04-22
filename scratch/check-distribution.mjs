import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function checkDistribution() {
    const categories = ['SPOT', 'RESTAURANT', 'MART', 'HOSPITAL', 'GAS_STATION', 'FESTIVAL'];
    console.log('--- [Category Distribution] ---');

    for (const cat of categories) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .eq('category', cat);
        
        if (error) {
            console.error(`Error counting ${cat}:`, error.message);
            continue;
        }
        console.log(`${cat}: ${count}`);
    }
}

checkDistribution().catch(console.error);
