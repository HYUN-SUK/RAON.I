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

async function manualSync(targetDateStr) {
    console.log(`Starting manual D-3 sync for ${targetDateStr}...`);
    
    const { data: schedules } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('check_in', targetDateStr);
    
    console.log(`Found ${schedules?.length || 0} schedules.`);

    for (const s of schedules || []) {
        let lat = s.campground_lat;
        let lng = s.campground_lng;

        if (!lat || !lng) {
            console.log(`Searching fallback for ${s.campground_name}...`);
            const { data: match } = await supabase
                .from('master_places')
                .select('lat, lng')
                .ilike('name', `%${s.campground_name.trim()}%`)
                .not('lat', 'is', null)
                .limit(1);
            
            if (match && match.length > 0) {
                lat = match[0].lat;
                lng = match[0].lng;
                console.log(`Found fallback: [${lat}, ${lng}]`);
            }
        }

        if (!lat || !lng) continue;

        const facts = [];
        const now = new Date().toISOString();
        
        // Hospital
        try {
            const res = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent('충청남도')}&STAGE2=${encodeURIComponent('예산군')}&numOfRows=10&_type=json`);
            const data = await res.json();
            const items = data.response?.body?.items?.item || [];
            (Array.isArray(items) ? items : [items]).forEach(item => {
                facts.push({
                    id: generateFactId('NMC_HOSPITAL', item.dutyName, item.dutyAddr),
                    api_source: 'NMC_HOSPITAL', category: 'HOSPITAL', name: item.dutyName,
                    address: item.dutyAddr, lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                    trust_score: 50, raw_data: item,
                    created_at: now
                });
            });
        } catch (e) { console.error("Hospital error", e); }

        // Gas (Simplified)
        try {
            facts.push({
                id: generateFactId('MANUAL', '테스트 주유소', s.campground_address || '충정남도 예산군'),
                api_source: 'MANUAL', category: 'GAS_STATION', name: '예산 근처 주유소 (테스트)',
                address: s.campground_address || '주소 정보 없음', lat: lat, lng: lng,
                trust_score: 90, raw_data: {},
                created_at: now
            });
        } catch (e) {}

        if (facts.length > 0) {
            const { error } = await supabase.from('smart_plan_facts').upsert(facts);
            console.log(`Saved ${facts.length} facts for ${s.campground_name}. Error:`, error);
        }
    }
}

manualSync('2026-03-24');
