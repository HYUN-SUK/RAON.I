import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function testRPC() {
    console.log("Testing RPC performance...");
    const targetLat = 36.626; 
    const targetLng = 126.83; // Check exactly this coord
    
    const start = Date.now();
    const { data: dbItems, error } = await supabase.rpc('get_master_places_in_radius', {
        target_lat: targetLat, target_lng: targetLng, radius_meters: 30000, limit_count: 500
    });
    const dur = Date.now() - start;
    
    console.log(`RPC count: 500 => Duration: ${dur}ms, Error: ${error ? JSON.stringify(error) : 'None'}`);
    console.log(`Found items: ${dbItems?.length}`);
}

testRPC();
