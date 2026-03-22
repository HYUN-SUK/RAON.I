import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import proj4 from 'proj4';
import { v5 as uuidv5 } from 'uuid';

dotenv.config({ path: '.env.local' });
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const publicApiKey = process.env.PUBLIC_DATA_API_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

async function diagnoseD3() {
    console.log("Starting D-3 Diagnosis...");
    const targetLat = 36.6575; // Yesan example
    const targetLng = 126.6853;
    const testCluster = { lat: targetLat, lng: targetLng, names: ['Test Campground'], address: '충청남도 예산군' };

    console.log(`[1] Fetching NMC Hospital API...`);
    const doNm = '충청남도'; const sigunguNm = '예산군';
    try {
        const res = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent(doNm)}&STAGE2=${encodeURIComponent(sigunguNm)}&pageNo=1&numOfRows=10&_type=json`);
        const data = await res.json();
        console.log(`  -> NMC Hospital Items: ${data.response?.body?.items?.item ? Array.isArray(data.response.body.items.item) ? data.response.body.items.item.length : 1 : 0}`);
    } catch(e) { console.error("  -> NMC Error", e.message); }

    console.log(`[2] Fetching FESTIVAL API...`);
    try {
        const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${publicApiKey}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${targetLng}&mapY=${targetLat}&radius=20000`);
        const data = await res.json();
        console.log(`  -> Festival Items: ${data.response?.body?.items?.item ? Array.isArray(data.response.body.items.item) ? data.response.body.items.item.length : 1 : 0}`);
    } catch(e) { console.error("  -> FESTIVAL Error", e.message); }

    console.log(`[3] Fetching OPINET GAS API...`);
    try {
        const OPINET_API_KEY = process.env.OPINET_API_KEY;
        proj4.defs("EPSG:5181", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");
        const [wtmX, wtmY] = proj4("EPSG:4326", "EPSG:5181", [targetLng, targetLat]);
        console.log(`  -> Converted KATEC: ${wtmX}, ${wtmY}`);
        const res = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX)}&y=${Math.round(wtmY)}&radius=5000&sort=1&prodcd=C004&out=json`);
        const data = await res.json();
        const gasCount = data?.RESULT?.OIL ? (Array.isArray(data.RESULT.OIL) ? data.RESULT.OIL.length : 1) : 0;
        console.log(`  -> Gas Items: ${gasCount}`);
    } catch(e) { console.error("  -> OPINET Error", e.message); }

    console.log(`\n[4] Querying master_places (Radius Search)...`);
    const { data: dbItems, error: rpcError } = await supabase.rpc('get_master_places_in_radius', {
        target_lat: targetLat, target_lng: targetLng, radius_meters: 30000, limit_count: 50
    });
    if (rpcError) console.error("  -> RPC Error:", rpcError);
    else console.log(`  -> Found ${dbItems?.length || 0} items from master_places.`);

    if (dbItems && dbItems.length > 0) {
        // Kakao Mock
        console.log(`\n[5] Testing Kakao Local Search Enrichment API...`);
        const cand = dbItems[0];
        const kakaoKey = process.env.KAKAO_REST_API_KEY;
        try {
            console.log(`  -> Sending query: ${cand.name} at ${cand.lng}, ${cand.lat}`);
            const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cand.name)}&x=${cand.lng}&y=${cand.lat}&radius=2000`, { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } });
            const kData = await kRes.json();
            console.log(`  -> Kakao Match: `, kData.documents?.[0]?.place_name || 'No match found');
        } catch(e) { console.error("  -> Kakao Local Error", e.message); }
    }
}

diagnoseD3();
