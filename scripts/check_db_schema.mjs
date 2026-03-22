import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkSchema() {
    const { data: cols } = await supabase.from('master_places').select('*').limit(1);
    console.log(cols && cols.length > 0 ? Object.keys(cols[0]) : "No data");
    
    const { data: proc } = await (supabase as any).from('pg_proc').select('prosrc').eq('proname', 'get_master_places_in_radius').limit(1);
    console.log(proc);
}
checkSchema();
