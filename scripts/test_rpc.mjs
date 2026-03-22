import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data: dbItems, error: rpcError } = await supabase.rpc('get_master_places_in_radius', {
        target_lat: 36.6575, target_lng: 126.6853, radius_meters: 30000, limit_count: 50
    });
    console.log("TEST RPC CALL:", { count: dbItems?.length, error: rpcError });
}

check();
