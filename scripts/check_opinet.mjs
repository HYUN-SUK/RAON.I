import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import proj4 from 'proj4';

dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectOpinetAndRPC() {
    console.log("--- OPINET TEST ---");
    const targetLat = 36.626;
    const targetLng = 126.83;
    const OPINET_API_KEY = process.env.OPINET_API_KEY;
    
    // Test OPINET
    try {
        proj4.defs("EPSG:5181", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");
        const ObjectX = proj4("EPSG:4326", "EPSG:5181", [targetLng, targetLat]);
        const wtmX = Math.round(ObjectX[0]);
        const wtmY = Math.round(ObjectX[1]);
        
        const url = `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${wtmX}&y=${wtmY}&radius=5000&sort=1&prodcd=C004&out=json`;
        console.log("Fetching:", url);
        const res = await fetch(url);
        const data = await res.json();
        console.log("OPINET RESULT:", JSON.stringify(data.RESULT).substring(0, 500));
    } catch(e) { console.error("Opinet Fetch Failed", e.message); }
    
    console.log("\n--- RPC SOURCE TEST ---");
    console.log("\nTrying RPC with p_category='MART'...");
    const { error: rpcErr } = await supabase.rpc('get_master_places_in_radius', {
        target_lat: 36.626, target_lng: 126.83, radius_meters: 30000, limit_count: 5, p_category: 'MART'
    });
    console.log("RPC Error with p_category:", rpcErr ? rpcErr.message : "SUCCESS!");
}
inspectOpinetAndRPC();
