import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function deepAudit() {
    console.log("=== RAONAI Deep Automation Audit Phase 2 ===\n");

    // 1. MASTER_SYNC Breakdown (Last 24h)
    console.log("--- 1. MASTER_SYNC (Weekly Batch) Detail ---");
    const { data: sources } = await supabase
        .from('master_places')
        .select('category, api_source')
        .gte('updated_at', '2026-03-22T15:00:00Z');

    const stats = {};
    sources?.forEach(s => {
        const cat = s.category;
        const src = s.api_source;
        if (!stats[cat]) stats[cat] = {};
        if (!stats[cat][src]) stats[cat][src] = 0;
        stats[cat][src]++;
    });

    console.log("Categories and Sources updated today in master_places:");
    console.log(JSON.stringify(stats, null, 2));

    // Estimating API Fetch Counts (based on script logic)
    console.log("\n[API Probe Results]");
    // Restaurant: Baeknyeon (ODCloud)
    // Mart: LocalData ZIP
    // Restaurant: Safe Restaurant (Gov API)
    
    // 2. Gas Station Investigation
    console.log("\n--- 2. Gas Station (Opinet) Investigation ---");
    const OPINET_API_KEY = process.env.OPINET_API_KEY;
    const targetLat = 36.626;
    const targetLng = 126.83;
    
    import('proj4').then(async (proj4) => {
        const p4 = proj4.default;
        p4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");
        const [wtmX, wtmY] = p4("EPSG:4326", "TM128", [targetLng, targetLat]);
        
        console.log(`Targeting Yesan: ${targetLat}, ${targetLng} -> TM128: ${wtmX}, ${wtmY}`);
        
        const url = `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX)}&y=${Math.round(wtmY)}&radius=5000&sort=1&prodcd=C004&out=json`;
        try {
            const res = await fetch(url);
            const data = await res.json();
            console.log(`Opinet 5km Result: ${data.RESULT?.OIL?.length || 0} stations found.`);
        } catch (e) {
            console.log("Opinet Fetch Failed.");
        }
    });

    // 3. Mismatch logic proof
    console.log("\n--- 3. Mismatch Logic Analysis ---");
    const { count: mpCount } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'HOSPITAL');
    
    const { count: spCount } = await supabase
        .from('smart_plan_facts')
        .select('*', { count: 'exact', head: true })
        .eq('category', 'HOSPITAL');

    console.log(`HOSPITAL: master_places total count = ${mpCount}`);
    console.log(`HOSPITAL: smart_plan_facts total count = ${spCount}`);
}

deepAudit();
