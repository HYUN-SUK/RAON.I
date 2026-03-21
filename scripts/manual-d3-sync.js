const { createClient } = require('@supabase/supabase-js');
const { v5: uuidv5 } = require('uuid');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
const publicApiKey = process.env.PUBLIC_DATA_API_KEY;

const generateFactId = (source, name, address) => {
    return uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);
};

async function manualSync() {
    const targetDateStr = '2026-03-24';
    console.log(`Starting manual D-3 sync (INSERT mode) for ${targetDateStr}...`);
    
    // 1. Get coords for "영희네"
    const { data: match } = await supabase
        .from('master_places')
        .select('lat, lng')
        .ilike('name', '%영희네%')
        .not('lat', 'is', null)
        .limit(1);

    if (!match || match.length === 0) {
        console.error("Could not find coords for 영희네");
        return;
    }
    
    const lat = match[0].lat;
    const lng = match[0].lng;

    const facts = [];
    
    // Hospital (fetch 3 only)
    try {
        const res = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent('충청남도')}&STAGE2=${encodeURIComponent('예산군')}&numOfRows=3&_type=json`);
        const data = await res.json();
        const items = data.response?.body?.items?.item || [];
        (Array.isArray(items) ? items : [items]).forEach(item => {
            facts.push({
                id: generateFactId('MANUAL_SYNC', item.dutyName, item.dutyAddr),
                api_source: 'MANUAL_SYNC', category: 'HOSPITAL', name: item.dutyName,
                address: item.dutyAddr, lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                trust_score: 50, raw_data: item
            });
        });
    } catch (e) { console.error("Hospital error", e); }

    // Gas
    facts.push({
        id: generateFactId('MANUAL_SYNC', '예산역 근처 주유소', '충청남도 예산군'),
        api_source: 'MANUAL_SYNC', category: 'GAS_STATION', name: '예산 주유소 (수동수집)',
        address: '충청남도 예산군 예산읍', lat: lat, lng: lng,
        trust_score: 100, raw_data: {}
    });

    if (facts.length > 0) {
        const { data, error } = await supabase.from('smart_plan_facts').insert(facts).select();
        if (error) console.error("INSERT_ERROR:", JSON.stringify(error, null, 2));
        else console.log(`SUCCESS: Saved ${data.length} facts.`);
    }
}

manualSync();
