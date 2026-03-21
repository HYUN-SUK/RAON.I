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
    console.log(`Starting final manual sync for ${targetDateStr}...`);
    
    // Find 영희네 coords
    const { data: match } = await supabase
        .from('master_places')
        .select('lat, lng')
        .ilike('name', '%영희네%')
        .limit(1);

    const lat = match[0]?.lat || 36.725322;
    const lng = match[0]?.lng || 127.3383895;

    const facts = [];
    const now = new Date().toISOString();
    
    // Hospital
    try {
        const res = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent('충청남도')}&STAGE2=${encodeURIComponent('예산군')}&numOfRows=5&_type=json`);
        const data = await res.json();
        const items = data.response?.body?.items?.item || [];
        (Array.isArray(items) ? items : [items]).forEach(item => {
            facts.push({
                id: generateFactId('MANUAL_FINAL', item.dutyName, item.dutyAddr),
                api_source: 'MANUAL_FINAL', category: 'HOSPITAL', name: item.dutyName,
                address: item.dutyAddr, lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                trust_score: 90, raw_data: item,
                created_at: now, updated_at: now
            });
        });
    } catch (e) {}

    // Gas
    facts.push({
        id: generateFactId('MANUAL_FINAL', '예산 테스트 주유소', '충청남도 예산군'),
        api_source: 'MANUAL_FINAL', category: 'GAS', name: '예산 주유소 (테스트)',
        address: '충청남도 예산군 예산읍', lat: lat, lng: lng,
        trust_score: 100, raw_data: {},
        created_at: now, updated_at: now
    });

    // Festival (Mock for test session)
    facts.push({
        id: generateFactId('MANUAL_FINAL', '예산 벚꽃 축제', '충청남도 예산군'),
        api_source: 'MANUAL_FINAL', category: 'FESTIVAL', name: '예산 벚꽃 축제 (가상 테스트)',
        address: '예산군 일원', lat: lat, lng: lng,
        trust_score: 85, raw_data: {},
        created_at: now, updated_at: now
    });

    if (facts.length > 0) {
        const { data, error } = await supabase.from('smart_plan_facts').upsert(facts).select();
        if (error) console.error("UPSERT_ERROR:", JSON.stringify(error, null, 2));
        else console.log(`SUCCESS: Saved ${data.length} total facts.`);
    }
}

manualSync();
