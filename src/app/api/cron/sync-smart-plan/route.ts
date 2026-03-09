import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { scrapeKakaoPlace } from '@/lib/scraper';

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

        interface SmartPlanFact {
            id: string;
            api_source: string;
            category: string;
            name: string;
            description: string;
            address: string;
            lat: number;
            lng: number;
            trust_score: number;
            raw_data: any;
        }

        const allFacts: SmartPlanFact[] = [];
        const successSources: Set<string> = new Set();

        const isWithinServiceArea = (lat: number, lng: number, cLat: number, cLng: number) => {
            const dist = Math.sqrt(Math.pow(lat - cLat, 2) + Math.pow(lng - cLng, 2));
            return dist <= 0.3; // 검색 반경 약 30km 제한
        };

        // 3. Phase 11 & 12 Hybrid Architecture
        for (let i = 0; i < clusters.length; i++) {
            const cluster = clusters[i];
            const targetLat = cluster.lat;
            const targetLng = cluster.lng;

            const addrParts = cluster.address.split(' ');
            const doNm = addrParts[0] || '충청남도';
            const sigunguNm = addrParts[1] || '예산군';

            console.log(`[Smart Plan Cron] Cluster ${i + 1}/${clusters.length}: ${doNm} ${sigunguNm}`);

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
                    successSources.add('NMC_HOSPITAL');
                }
            } catch (e: any) { console.error("NMC_HOSPITAL Error", e); }

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
                    successSources.add('TOUR_FSTVL');
                }
            } catch (e: any) { console.error("TOUR_FSTVL Error", e); }

            // 3. Phase 12: Kakao Enrichment (Static Data: RESTAURANT, MART, SPOT)
            const staticCategories: ('RESTAURANT' | 'MART' | 'SPOT')[] = ['RESTAURANT', 'SPOT', 'MART'];
            for (const cat of staticCategories) {
                try {
                    const { data: candidates, error: err } = await supabase.rpc('get_master_places_in_radius', {
                        target_lat: targetLat,
                        target_lng: targetLng,
                        radius_meters: 20000,
                        limit_count: 50 // Fetch more initially to allow weather-based filtering
                    });

                    if (!err && candidates && candidates.length > 0) {
                        // [Phase 11 High-Level Logic] Weather-Aware 1st Selection
                        // Fetch weather for the target cluster to prioritize candidates
                        const forecastRes = await fetch(`http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${publicApiKey}&numOfRows=10&pageNo=1&base_date=${new Date().toISOString().split('T')[0].replace(/-/g, '')}&base_time=0500&nx=55&ny=127&_type=json`);
                        const weatherData = await forecastRes.json();
                        const isRaining = JSON.stringify(weatherData).includes('비') || JSON.stringify(weatherData).includes('소나기');

                        const filteredCandidates = candidates
                            .filter((c: any) => c.category === cat)
                            .map((c: any) => {
                                let weatherWeight = 0;
                                if (isRaining) {
                                    if (c.name.includes('탕') || c.name.includes('찌개') || c.name.includes('전골')) weatherWeight += 20;
                                    if (c.description?.includes('실내') || c.description?.includes('박물관')) weatherWeight += 20;
                                }
                                return { ...c, temp_score: (c.trust_score || 0) + weatherWeight };
                            })
                            .sort((a: any, b: any) => b.temp_score - a.temp_score)
                            .slice(0, 20); // Select top 20 verified/weather-appropriate for scraping

                        const enrichedResults = [];

                        for (const cand of filteredCandidates) {
                            const kakaoKey = process.env.KAKAO_REST_API_KEY;
                            if (!kakaoKey) break;

                            const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cand.name)}&x=${cand.lng}&y=${cand.lat}&radius=2000`, {
                                headers: { 'Authorization': `KakaoAK ${kakaoKey}` }
                            });
                            const kData = await kRes.json();
                            const matched = kData.documents?.[0];

                            if (matched && matched.place_url) {
                                const scResult = await scrapeKakaoPlace(matched.place_url);
                                let finalScore = (cand.trust_score || 50);
                                if (scResult.success) {
                                    if (scResult.rating >= 4.0) finalScore += 30;
                                    if (scResult.reviewCount >= 20) finalScore += 20;
                                    if (scResult.rating > 0 && scResult.rating < 3.0) finalScore -= 40;
                                }

                                enrichedResults.push({
                                    id: crypto.randomUUID(), api_source: 'MASTER_ENRICHED', category: cand.category,
                                    name: cand.name, address: cand.address, lat: cand.lat, lng: cand.lng,
                                    trust_score: Math.min(finalScore, 100),
                                    description: scResult.success
                                        ? `${cand.description} (별점: ${scResult.rating}, 리뷰: ${scResult.reviewCount}건)`
                                        : cand.description,
                                    raw_data: { ...cand.raw_data, kakao_url: matched.place_url, scraping: scResult }
                                });
                            }
                            await new Promise(r => setTimeout(r, 100)); // Rate limit defense
                        }

                        const top3 = enrichedResults.sort((a, b) => b.trust_score - a.trust_score).slice(0, 3);
                        allFacts.push(...top3);
                        if (top3.length > 0) successSources.add('MASTER_ENRICHED');
                    }
                } catch (e: any) { console.error(`${cat} Enrichment Error`, e); }
            }

            if (i < clusters.length - 1) {
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // 8. DB Save (Upsert) 및 TTL
        const validFacts = allFacts.filter(f => f.name && !isNaN(f.lat) && !isNaN(f.lng));
        const sourcesArray = Array.from(successSources);
        let processedCount = 0;

        const obsoleteDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        await supabase.from('smart_plan_facts').delete().lt('created_at', obsoleteDate);

        for (const source of sourcesArray) {
            const chunk = validFacts.filter(f => f.api_source === source);
            if (chunk.length > 0) {
                const { error } = await supabase.from('smart_plan_facts').insert(chunk);
                if (!error) processedCount += chunk.length;
            }
        }

        return NextResponse.json({ success: true, processed_count: processedCount, clusters: clusters.length });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
