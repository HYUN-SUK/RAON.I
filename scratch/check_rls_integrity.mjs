import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function runIntegrityCheck() {
    const { data: places, error: masterErr } = await supabase
        .from('master_places')
        .select('id, name, category')
        .limit(5);
    
    if (masterErr) {
        console.error('❌ master_places SELECT FAIL:', masterErr);
    } else {
        console.log(`✅ master_places SELECT PASS: Fetched ${places.length} sample items:`, places.map(p => p.name).join(', '));
    }
}

runIntegrityCheck();
