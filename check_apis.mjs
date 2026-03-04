import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;
const OPINET_KEY = process.env.OPINET_API_KEY;
const SAFE_KEY = process.env.SAFE_RESTAURANT_API_KEY;

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const apis = [
    { name: '1. 모범음식점정보 (행안부)', url: `https://apis.data.go.kr/1741000/excellent_restaurant_info/info?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=1&returnType=json` },
    { name: '2. 대규모점포 (행안부)', url: `https://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=1&returnType=json` },
    { name: '3. 전국 백년가게 (소상공인)', url: `https://api.odcloud.kr/api/15102255/v1/uddi:fcb174b1-8b01-4964-b814-a70c8967d23e?page=1&perPage=10`, headers: { 'Authorization': `Infuser ${PUBLIC_KEY}` } },
    { name: '4. 응급의료기관 (NMC)', url: `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_KEY}&STAGE1=${encodeURIComponent('충청남도')}&STAGE2=${encodeURIComponent('예산군')}&pageNo=1&numOfRows=10&_type=json` },
    { name: '5. 전국문화축제표준데이터', url: `http://api.data.go.kr/openapi/tn_pubr_public_cltur_fstvl_api?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=1&type=json`, headers: { 'User-Agent': 'Mozilla/5.0' } },
    { name: '6. 전국공연행사표준데이터', url: `http://api.data.go.kr/openapi/tn_pubr_public_prmn_fesvl_api?serviceKey=${PUBLIC_KEY}&pageNo=1&numOfRows=1&type=json`, headers: { 'User-Agent': 'Mozilla/5.0' } },
    { name: '7. 국문 관광정보 서비스_GW', url: `http://apis.data.go.kr/B551011/KorService1/areaBasedList1?serviceKey=${PUBLIC_KEY}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&lDongRegnCd=44&lDongSignguCd=44810` },
    { name: '8. 오피넷 (주유소)', url: `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_KEY}&x=314640&y=544387&radius=5000&sort=1&prodcd=C004&out=json` },
    { name: '9. 안심식당 (농식품부)', url: `http://211.237.50.150:7080/openapi/${SAFE_KEY}/json/Grid_20200713000000000605_1/1/1` }
];

async function run() {
    console.log("=========================================");
    console.log("1. API 접속 상태 점검 (재신청 4개 포함)");
    console.log("=========================================");
    for (const api of apis) {
        try {
            const res = await fetch(api.url, { headers: api.headers || { 'User-Agent': 'Mozilla/5.0' }, method: 'GET' });
            const text = await res.text();

            let status = '✅ 정상 (200)';
            let note = '';

            if (res.status !== 200) {
                status = `🚨 에러 (${res.status})`;
            }

            if (text.includes("SERVICE_KEY_IS_NOT_REGISTERED_ERROR") || text.includes("<resultCode>30</resultCode>") || text.includes("등록되지 않은 서비스")) {
                status = `🚨 인증/권한 에러`;
                note = text.substring(0, 50).replace(/\n/g, "");
            } else if (text.trim().startsWith("<!DOCTYPE html>") || text.includes("<title>")) {
                note = "HTML 반환 (WAF 차단)";
                status = `🚨 차단 (WAF)`;
            } else if (text.includes("Unexpected errors") || res.status === 500) {
                status = `🚨 관광공사 내부망 장애 (500 터짐)`;
            } else {
                note = `데이터 응답크기: ${text.length} bytes`;
            }

            console.log(`[${api.name}] -> ${status} | ${note}`);
        } catch (e) {
            console.log(`[${api.name}] -> 🚨 네트워크 오류 | ${e.message}`);
        }
    }

    console.log("\n=========================================");
    console.log("2. 2026-03-04 DB 갱신(Cron Sync) 내역 분석");
    console.log("=========================================");

    // Check smart_plan_facts
    const { data: facts } = await supabase.from('smart_plan_facts').select('api_source, created_at, updated_at').order('created_at', { ascending: false }).limit(300);

    // Convert to KST to check date simply filtering startsWith('2026-03-04') might be offset because UTC time of KST 06:00 is 21:00 the day before.
    // Let's just output the exact KST time of the newest sync.
    const latestSyncUTC = facts?.[0]?.created_at;
    let latestKST = '없음';

    if (latestSyncUTC) {
        const utcDate = new Date(latestSyncUTC);
        const kstDate = new Date(utcDate.getTime() + (9 * 60 * 60 * 1000));
        latestKST = kstDate.toISOString().replace('T', ' ').substring(0, 19);
    }

    console.log(`- 기준: (모든 데이터 확인)`);
    console.log(`- DB 상 가장 최근 데이터가 수집된 시간(한국시간 기준): ${latestKST}`);

    // If it was ran at Mar 3 21:00 UTC, KST is Mar 4 06:00
    const todayTarget = '2026-03-03T21'; // matching cron 0 21 * * *
    const recentFacts = facts?.filter(f => f.created_at.includes(todayTarget) || f.created_at.startsWith('2026-03-04')) || [];

    console.log(`- 오늘 새벽 6시 전후 수집 성공한 팩트: 총 ${recentFacts.length}건`);

    const sources = {};
    recentFacts.forEach(f => {
        sources[f.api_source] = (sources[f.api_source] || 0) + 1;
    });
    for (const [key, val] of Object.entries(sources)) {
        console.log(`  -> API Source [${key}]: ${val}건 적재 완료`);
    }
}

run();
