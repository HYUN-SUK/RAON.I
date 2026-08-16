import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkRpcColumns() {
    const { data: sample } = await supabase.rpc('get_master_places_in_radius_v2', {
        target_lat: 35.1609477290535,
        target_lng: 129.167194019805,
        radius_meters: 5000,
        limit_count: 3,
        p_category: 'RESTAURANT'
    });

    console.log('Sample RPC row keys:', Object.keys(sample?.[0] || {}));
    console.log('Sample RPC row category:', sample?.[0]?.category);
}

checkRpcColumns();
