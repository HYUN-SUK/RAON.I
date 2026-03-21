const { createClient } = require('@supabase/supabase-js');
const { v5: uuidv5 } = require('uuid');
const proj4 = require('proj4');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const publicApiKey = process.env.PUBLIC_DATA_API_KEY;

const generateFactId = (source, name, address) => {
    return uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);
};

async function maxManualSync() {
    const targetDateStr = '2026-03-24';
    console.log(`Starting MAX manual sync for ${targetDateStr}...`);
    
    // Coords for 영희네
    const targetLat = 36.725322;
    const targetLng = 127.3383895;
    const now = new Date().toISOString();

    const allFacts = [];

    // 1. Hospital (Regional - Max 100)
    try {
        const res = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent('충청남도')}&STAGE2=${encodeURIComponent('예산군')}&pageNo=1&numOfRows=100&_type=json`);
        const data = await res.json();
        const items = data.response?.body?.items?.item || [];
        (Array.isArray(items) ? items : [items]).forEach(item => {
            allFacts.push({
                id: generateFactId('NMC_HOSPITAL', item.dutyName, item.dutyAddr),
                api_source: 'NMC_HOSPITAL', category: 'HOSPITAL', name: item.dutyName,
                description: '응급실 가동 응급의료기관', address: item.dutyAddr,
                lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                trust_score: 90, raw_data: item, created_at: now, updated_at: now
            });
        });
    } catch (e) {}

    // 2. Festival (Location-based - Max 100, 20km)
    try {
        const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${publicApiKey}&numOfRows=100&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${targetLng}&mapY=${targetLat}&radius=20000`);
        const data = await res.json();
        const items = data.response?.body?.items?.item || [];
        (Array.isArray(items) ? items : [items]).forEach(item => {
            allFacts.push({
                id: generateFactId('TOUR_FSTVL', item.title, item.addr1),
                api_source: 'TOUR_FSTVL', category: 'FESTIVAL', name: item.title,
                description: '주변 로컬 축제/이벤트', address: item.addr1,
                lat: parseFloat(item.mapy), lng: parseFloat(item.mapx),
                trust_score: 80, raw_data: item, created_at: now, updated_at: now
            });
        });
    } catch (e) {}

    // 3. GasStations (Opinet - NO SLICE)
    try {
        const OPINET_API_KEY = process.env.OPINET_API_KEY;
        if (OPINET_API_KEY) {
            proj4.defs("EPSG:5181", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");
            const [wtmX, wtmY] = proj4("EPSG:4326", "EPSG:5181", [targetLng, targetLat]);
            const res = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX)}&y=${Math.round(wtmY)}&radius=5000&sort=1&prodcd=C004&out=json`);
            const data = await res.json();
            const items = data.RESULT?.OIL || [];
            (Array.isArray(items) ? items : [items]).forEach(item => {
                allFacts.push({
                    id: generateFactId('OPINET_GAS', item.OS_NM, item.VAN_ADR || '주소없음'),
                    api_source: 'OPINET_GAS', category: 'GAS', name: item.OS_NM,
                    description: `등유: ${item.K_PRICE}원`, address: item.VAN_ADR || '주소 정보 없음',
                    lat: targetLat, lng: targetLng, trust_score: 90, raw_data: item, created_at: now, updated_at: now
                });
            });
        }
    } catch (e) {}

    console.log(`Gathered TOTAL: ${allFacts.length} items.`);
    
    let successCount = 0;
    for (const f of allFacts) {
        const { error } = await supabase.from('smart_plan_facts').upsert(f);
        if (!error) successCount++;
    }
    console.log(`Successfully saved ${successCount} facts.`);
}

maxManualSync();
