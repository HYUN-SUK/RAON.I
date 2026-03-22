import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
console.log("OPINET_API_KEY exists?", !!process.env.OPINET_API_KEY);
console.log("SAFE_RESTAURANT_API_KEY exists?", !!process.env.SAFE_RESTAURANT_API_KEY);
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkRPC() {
    // Try to get RPC definition
    const { data, error } = await supabase.rpc('get_master_places_in_radius', {
        target_lat: 36.6, target_lng: 126.6, radius_meters: 100, limit_count: 1
    });
    console.log("RPC Test:", data?.length, error);
}
checkRPC();
