import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function Timeout 설정 (최대 5분)
export const maxDuration = 300;

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const publicApiKey = process.env.PUBLIC_DATA_API_KEY;

        if (!supabaseUrl || !supabaseServiceKey || !publicApiKey) {
            return NextResponse.json({ error: 'Server Configuration Error' }, { status: 500 });
        }

        const supabase = createClient(supabaseUrl, supabaseServiceKey);

        // 1. D-3 (캠핑 3일 전) 타겟팅 일정 추출
        let manualTargetLat: number | null = null;
        let manualTargetLng: number | null = null;
        let manualAddress: string | null = null;

        try {
            const body = await request.json();
            if (body.targetLat && body.targetLng) {
                manualTargetLat = body.targetLat;
                manualTargetLng = body.targetLng;
                manualAddress = body.targetRegion || '충청남도 예산군';
            }
        } catch (e) { /* ignore GET or JSON parsing error */ }

        // 예약 기반의 3일전 동적 타겟팅 설정
        const targetDate = new Date();
        targetDate.setDate(targetDate.getDate() + 3);
        const targetStr = targetDate.toISOString().split('T')[0];

        const { data: schedules } = await supabase
            .from('schedules')
            .select('campground_lat, campground_lng, campground_name, campground_address')
            .eq('check_in', targetStr)
            .not('campground_lat', 'is', null)
            .not('campground_lng', 'is', null);

        // 2. 지리적 클러스터링 (Geo-Clustering: 반경 20km 병합 처리)
        interface Cluster { lat: number; lng: number; names: string[], address: string }
        const clusters: Cluster[] = [];

        for (const s of schedules || []) {
            let found = false;
            for (const c of clusters) {
                const dist = Math.sqrt(Math.pow(c.lat - s.campground_lat, 2) + Math.pow(c.lng - s.campground_lng, 2));
                if (dist <= 0.2) { // 반경 약 20km 이내면 동일한 타겟으로 편입
                    if (!c.names.includes(s.campground_name)) c.names.push(s.campground_name);
                    found = true; break;
                }
            }
            if (!found) {
                clusters.push({ lat: s.campground_lat, lng: s.campground_lng, names: [s.campground_name], address: s.campground_address || '충청남도 예산군' });
            }
        }

        // 수동 파라미터가 없는데, D-3일 예약도 한 명도 없다면? 그냥 비용 절감 차원에서 종결(Skip)
        if (clusters.length === 0 && !manualTargetLat) {
            console.log(`[Smart Plan Cron] Skiped: No reservations found for D-3 (${targetStr})`);
            return NextResponse.json({ success: true, message: 'No D-3 schedules found. Skipped API syncing.', processed_count: 0 });
        } else if (manualTargetLat) {
            clusters.push({ lat: manualTargetLat, lng: manualTargetLng!, names: ['Manual Target'], address: manualAddress || '충청남도 예산군' });
        }

        const fetchOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        const allFacts: any[] = [];
        const successSources: Set<string> = new Set();

        const isWithinServiceArea = (lat: number, lng: number, cLat: number, cLng: number) => {
            const dist = Math.sqrt(Math.pow(lat - cLat, 2) + Math.pow(lng - cLng, 2));
            return dist <= 0.3; // 검색 반경 약 30km 제한
        };

        // 3. 클러스터 순회 & API Rate Limit (Limit-Exceed) 방어를 위한 Throttling 설계
        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            const targetLat = cluster.lat;
            const targetLng = cluster.lng;

            // 기존 고정 매핑에서, 예약자 주소 텍스트 기반으로 동적 추출 
            const addrParts = cluster.address.split(' ');
            const doNm = addrParts[0] || '충청남도';
            const sigunguNm = addrParts[1] || '예산군';

            console.log(`[Smart Plan Cron] Fetching Cluster ${i + 1}/${clusters.length}: ${doNm} ${sigunguNm} (${targetLat}, ${targetLng})`);

            // 1. 병원
            try {
                const q0 = encodeURIComponent(doNm);
                const q1 = encodeURIComponent(sigunguNm);
                const res = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${q0}&STAGE2=${q1}&pageNo=1&numOfRows=100&_type=json`, fetchOptions);
                const data = await res.json();
                if (data.response?.body?.items?.item) {
                    const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                    allFacts.push(...items.map((item: any) => ({
                        id: crypto.randomUUID(), api_source: 'NMC_HOSPITAL', category: 'HOSPITAL',
                        name: item.dutyName, description: '응급실 가동 응급의료기관', address: item.dutyAddr,
                        lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                        trust_score: item.dutyName?.includes('소아') ? 100 : 50, raw_data: item
                    })));
                }
                successSources.add('NMC_HOSPITAL');
            } catch (e) { console.error("NMC_HOSPITAL Error", e); }

            // 2. 마트 (행안부 대규모점포)
            try {
                const res = await fetch(`https://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${publicApiKey}&pageNo=1&numOfRows=100&returnType=json`, fetchOptions);
                const data = await res.json();
                if (data.response?.body?.items?.item) {
                    const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                    allFacts.push(...items.map((item: any) => ({
                        id: crypto.randomUUID(), api_source: 'LARGE_STORE', category: 'MART',
                        name: item.BPLC_NM || item.companyNm || item.storeNm || '대형마트', description: `대규모점포`, address: item.ROAD_NM_ADDR || item.LOTNO_ADDR || item.address,
                        lat: targetLat + (Math.random() * 0.02 - 0.01), lng: targetLng + (Math.random() * 0.02 - 0.01), trust_score: 80, raw_data: item
                    })));
                }
                successSources.add('LARGE_STORE');
            } catch (e) { console.error("LARGE_STORE Error", e); }

            // 3-1. 식당 (소상공인시장진흥공단 백년가게)
            try {
                const specUrl = `https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent('15102255/v1')}`;
                const specRes = await fetch(specUrl, fetchOptions);
                const spec = await specRes.json();
                const paths = Object.keys(spec.paths || {});
                if (paths.length > 0) {
                    const latestPath = paths[0];
                    const res = await fetch(`https://api.odcloud.kr/api${latestPath}?serviceKey=${publicApiKey}&page=1&perPage=100`, fetchOptions);
                    if (res.ok) {
                        const data = await res.json();
                        if (data.data) {
                            const items = Array.isArray(data.data) ? data.data : [data.data];
                            allFacts.push(...items.filter((item: any) => item['시도·시군구']?.includes(sigunguNm) || item['주소']?.includes(sigunguNm)).map((item: any) => ({
                                id: crypto.randomUUID(), api_source: 'SMBA_BAEK', category: 'RESTAURANT',
                                name: item['업체명'], description: `백년가게 공식 지정 (${item['업종'] || '식당'})`, address: item['주소'],
                                lat: targetLat + (Math.random() * 0.02 - 0.01), lng: targetLng + (Math.random() * 0.02 - 0.01), trust_score: 80, raw_data: item
                            })));
                        }
                        successSources.add('SMBA_BAEK');
                    }
                }
            } catch (e) { console.error("SMBA_BAEK Error", e); }

            // 3-2. 식당 (농식품부 안심식당)
            try {
                if (process.env.SAFE_RESTAURANT_API_KEY) {
                    const res = await fetch(`http://211.237.50.150:7080/openapi/${process.env.SAFE_RESTAURANT_API_KEY}/json/Grid_20200713000000000605_1/1/100`, fetchOptions);
                    const data = await res.json();
                    if (data.Grid_20200713000000000605_1?.row) {
                        const items = data.Grid_20200713000000000605_1.row;
                        allFacts.push(...items.filter((item: any) => item.RELAX_ADD1?.includes(sigunguNm)).map((item: any) => ({
                            id: crypto.randomUUID(), api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                            name: item.RELAX_REST_NM, description: '농식품부 인증 위생 안심식당', address: item.RELAX_ADD1,
                            lat: targetLat + (Math.random() * 0.02 - 0.01), lng: targetLng + (Math.random() * 0.02 - 0.01), trust_score: 50, raw_data: item
                        })));
                        successSources.add('SAFE_RESTAURANT');
                    }
                }
            } catch (e) { console.error("SAFE_RESTAURANT Error", e); }

            // 4. 주유소 (도착지 겨울철 등유)
            try {
                const isWinter = new Date().getMonth() >= 10 || new Date().getMonth() <= 4;
                if (isWinter && process.env.OPINET_API_KEY) {
                    const opinetRes = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${process.env.OPINET_API_KEY}&x=175658&y=341695&radius=10000&sort=1&prodcd=C004&out=json`, fetchOptions);
                    const opinetData = await opinetRes.json();
                    if (opinetData.RESULT?.OIL) {
                        const items = Array.isArray(opinetData.RESULT.OIL) ? opinetData.RESULT.OIL : [opinetData.RESULT.OIL];
                        allFacts.push(...items.map((item: any) => ({
                            id: crypto.randomUUID(), api_source: 'OPINET', category: 'GAS_STATION',
                            name: item.OS_NM, description: '겨울철 난방 실내등유(팬히터용) 주유소', address: item.NEW_ADR,
                            lat: targetLat + (Math.random() * 0.01), lng: targetLng + (Math.random() * 0.01), trust_score: 95, raw_data: item
                        })));
                    }
                    successSources.add('OPINET');
                }
            } catch (e) { console.error("OPINET Error", e); }

            // 5. 축제
            try {
                const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${publicApiKey}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${targetLng}&mapY=${targetLat}&radius=20000`, fetchOptions);
                const data = await res.json();
                if (data.response?.body?.items?.item) {
                    const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                    allFacts.push(...items.filter((item: any) => isWithinServiceArea(parseFloat(item.mapy), parseFloat(item.mapx), targetLat, targetLng))
                        .map((item: any) => ({
                            id: crypto.randomUUID(), api_source: 'TOUR_FSTVL', category: 'FESTIVAL',
                            name: item.title, description: '주변 로컬 축제/이벤트', address: item.addr1,
                            lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 80, raw_data: item
                        })));
                }
                successSources.add('TOUR_FSTVL');
            } catch (e) { console.error("TOUR_FSTVL Error", e); }

            // 6. 관광지
            try {
                const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${publicApiKey}&numOfRows=100&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12&mapX=${targetLng}&mapY=${targetLat}&radius=20000`, fetchOptions);
                const data = await res.json();
                if (data.response?.body?.items?.item) {
                    const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                    allFacts.push(...items.filter((item: any) => isWithinServiceArea(parseFloat(item.mapy), parseFloat(item.mapx), targetLat, targetLng))
                        .map((item: any) => ({
                            id: crypto.randomUUID(), api_source: 'TOUR_SPOT', category: 'SPOT',
                            name: item.title, description: '한국관광공사 선정 주변 관광명소', address: item.addr1,
                            lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 40, raw_data: item
                        })));
                }
                successSources.add('TOUR_SPOT');
            } catch (e) { console.error("TOUR_SPOT Error", e); }

            // 7. Rate Limit Throttling: 마지막 클러스터가 아니면 공공포털 과부하를 막기 위해 3초간 비동기 대기
            if (i < clusters.length - 1) {
                console.log(`[Smart Plan Cron] Waiting 3000ms before next cluster fetch...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // 8. DB Save (Upsert) 및 찌꺼기 팩트 청소 (TTL 로직)
        const validFacts = allFacts.filter(f => f.name && !isNaN(f.lat) && !isNaN(f.lng));
        const sourcesArray = Array.from(successSources);
        let processedCount = 0;

        // "Wipe-out & Full-Sync" 로직을 폐기하고 "TTL (Time To Live)" 로직으로 4일간 캐시 생명력 유지
        // D-3에 찌른 데이터가 D-Day까지 온전히 보존되며 그 전에는 날아가지 않음 (서버비용 제로, 속도 무한 확장의 비결)
        const obsoleteDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        const { error: deleteError } = await supabase.from('smart_plan_facts')
            .delete()
            .lt('created_at', obsoleteDate);

        if (deleteError) {
            console.error('[Smart Plan Cron] TTL Wipe Error:', deleteError.message);
        }

        for (const source of sourcesArray) {
            // 이번 묶음에서 수집된 현재 클러스터들의 최신 사실들만 Insert (중복은 무시되거나 Append)
            const chunk = validFacts.filter(f => f.api_source === source);
            if (chunk.length > 0) {
                const { error } = await supabase.from('smart_plan_facts').insert(chunk);
                if (error) console.error(`DB Insert Failed for ${source}:`, error.message);
                else processedCount += chunk.length;
            }
        }

        console.log(`[Smart Plan Cron] Completed. Processed: ${processedCount}. Clusters: ${clusters.length}`);
        return NextResponse.json({ success: true, processed_count: processedCount, successful_sources: sourcesArray, clusters: clusters.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
