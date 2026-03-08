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

        // 3. Phase 11 Hybrid Architecture (Realtime Fetch ONLY)
        // Static data (MART, RESTAURANT, GAS_STATION, SPOT) is handled by 'master_places' backend.
        // We only fetch volatile dynamic data here: HOSPITAL, FESTIVAL (Weather is handled by AI Pipeline directly).
        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            const targetLat = cluster.lat;
            const targetLng = cluster.lng;

            const addrParts = cluster.address.split(' ');
            const doNm = addrParts[0] || '충청남도';
            const sigunguNm = addrParts[1] || '예산군';

            console.log(`[Smart Plan Cron] D-3 Fetching Dynamic Data for Cluster ${i + 1}/${clusters.length}: ${doNm} ${sigunguNm}`);

            // 1. 병원 (NMC_HOSPITAL)
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

            // 2. 한시적 축제 (TOUR_FSTVL)
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

            // Throttling: 마지막 클러스터가 아니면 공공포털 과부하를 막기 위해 3초간 비동기 대기
            if (i < clusters.length - 1) {
                console.log(`[Smart Plan Cron] Waiting 3000ms before next dynamic cluster fetch...`);
                await new Promise(resolve => setTimeout(resolve, 3000));
            }
        }

        // 8. DB Save (Upsert) 및 찌꺼기 팩트 청소 (TTL 로직)
        const validFacts = allFacts.filter(f => f.name && !isNaN(f.lat) && !isNaN(f.lng));
        const sourcesArray = Array.from(successSources);
        let processedCount = 0;

        // TTL 로직으로 4일간 캐시 생명력 유지
        const obsoleteDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        const { error: deleteError } = await supabase.from('smart_plan_facts')
            .delete()
            .lt('created_at', obsoleteDate);

        if (deleteError) {
            console.error('[Smart Plan Cron] TTL Wipe Error:', deleteError.message);
        }

        for (const source of sourcesArray) {
            // 이번 묶음에서 수집된 현재 클러스터들의 최신 사실들만 Insert
            const chunk = validFacts.filter(f => f.api_source === source);
            if (chunk.length > 0) {
                const { error } = await supabase.from('smart_plan_facts').insert(chunk);
                if (error) console.error(`DB Insert Failed for ${source}:`, error.message);
                else processedCount += chunk.length;
            }
        }

        console.log(`[Smart Plan Cron] Completed Dynamic Fetch. Processed: ${processedCount}. Clusters: ${clusters.length}`);
        return NextResponse.json({ success: true, processed_count: processedCount, successful_sources: sourcesArray, clusters: clusters.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
