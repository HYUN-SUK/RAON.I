import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const adminClient = createClient(supabaseUrl, serviceKey);
const anonClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

async function checkAccurateCounts() {
    const { count: mpCount } = await adminClient.from('master_places').select('id', { count: 'exact' }).limit(1);
    const { count: mpAnonCount } = await anonClient.from('master_places').select('id', { count: 'exact' }).limit(1);
    console.log(`master_places Admin Count: ${mpCount}, Anon Count: ${mpAnonCount}`);
}

checkAccurateCounts();
