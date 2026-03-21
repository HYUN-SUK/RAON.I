import { createClient } from '@supabase/supabase-js';
import { scrapeKakaoPlace } from '@/lib/scraper';
import proj4 from 'proj4';
import { v5 as uuidv5 } from 'uuid';

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8'; // UUID v5 Namespace

// Vercel Serverless Function Timeout 설정 (최대 5분)
export const maxDuration = 300;

export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get('authorization');
        if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
            return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401 });
        }

        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
        const publicApiKey = process.env.PUBLIC_DATA_API_KEY;

        if (!supabaseUrl || !supabaseServiceKey || !publicApiKey) {
            return new Response(JSON.stringify({ error: 'Server Configuration Error' }), { status: 500 });
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

        // 예약 기반의 3일전 동적 타겟팅 설정 (KST 기준)
        const now = new Date();
        const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const targetDate = new Date(kstNow);
        targetDate.setDate(kstNow.getDate() + 3);
        const targetStr = targetDate.toISOString().split('T')[0];

        const { data: schedules } = await supabase
            .from('user_schedules')
            .select('campground_lat, campground_lng, campground_name, campground_address')
            .eq('check_in', targetStr);

        // 2. 지리적 클러스터링 (Geo-Clustering: 반경 20km 병합 처리)
        interface Cluster { lat: number; lng: number; names: string[], address: string }
        const clusters: Cluster[] = [];

        for (const s of schedules || []) {
            let targetLat = s.campground_lat;
            let targetLng = s.campground_lng;

            // [Resilience Fallback] 좌표가 null일 경우 master_places에서 이름으로 역추적 시도
            if (!targetLat || !targetLng) {
                const { data: matchedPlaces } = await supabase
                    .from('master_places')
                    .select('lat, lng')
                    .ilike('name', `%${s.campground_name.trim()}%`)
                    .not('lat', 'is', null)
                    .limit(1);
                
                if (matchedPlaces && matchedPlaces.length > 0) {
                    targetLat = matchedPlaces[0].lat;
                    targetLng = matchedPlaces[0].lng;
                    console.log(`Fallback coordinates found for ${s.campground_name}: [${targetLat}, ${targetLng}]`);
                }
            }

            if (!targetLat || !targetLng) continue; // 여전히 좌표가 없으면 스킵

            let found = false;
            for (const c of clusters) {
                const dist = Math.sqrt(Math.pow(c.lat - targetLat, 2) + Math.pow(c.lng - targetLng, 2));
                if (dist <= 0.2) { // 반경 약 20km 이내면 동일한 타겟으로 편입
                    if (!c.names.includes(s.campground_name)) c.names.push(s.campground_name);
                    found = true; break;
                }
            }
            if (!found) {
                clusters.push({ lat: targetLat, lng: targetLng, names: [s.campground_name], address: s.campground_address || '충청남도 예산군' });
            }
        }

        // 수동 파라미터가 없는데, D-3일 예약도 한 명도 없다면? 그냥 비용 절감 차원에서 종결(Skip)하되 로그는 남김
        if (clusters.length === 0 && !manualTargetLat) {
            await supabase.from('automation_logs').insert({
                job_name: 'SMART_PLAN_CACHING',
                status: 'SUCCESS',
                processed_count: 0,
                message: 'No target schedules with valid coordinates found. Skipped API syncing.',
                target_date: targetStr
            });
            return new Response(JSON.stringify({ success: true, message: 'No D-3 schedules found. Skipped API syncing.', processed_count: 0 }), { status: 200 });
        } else if (manualTargetLat) {
            clusters.push({ lat: manualTargetLat, lng: manualTargetLng!, names: ['Manual Target'], address: manualAddress || '충청남도 예산군' });
        }

        const fetchOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } };

        const generateFactId = (source: string, name: string, address: string) => {
            return uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);
        };

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

        // 3. Phase 11 & 12 Hybrid Architecture (Parallelized & Timeout-Aware)
        const startTime = Date.now();
        const TIMEOUT_LIMIT = (maxDuration - 30) * 1000; // 270초 안전 마진

        for (let i = 0; i < clusters.length; i++) {
            // 타임아웃 임계점 도달 시 즉시 중단하고 수집된 것만 저장
            if (Date.now() - startTime > TIMEOUT_LIMIT) {
                console.warn("Approaching Vercel timeout. Prematurely finishing collection.");
                break;
            }

            const cluster = clusters[i];
            const targetLat = cluster.lat;
            const targetLng = cluster.lng;

            const addrParts = cluster.address.split(' ');
            const doNm = addrParts[0] || '충청남도';
            const sigunguNm = addrParts[1] || '예산군';

            // 1. 병원 (NMC_HOSPITAL) & 축제 (TOUR_FSTVL) & 주유소 (OPINET_GAS) 병렬 수집
            const apiTasks = [];

            // Hospital
            apiTasks.push((async () => {
                try {
                    const q0 = encodeURIComponent(doNm);
                    const q1 = encodeURIComponent(sigunguNm);
                    const res = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${q0}&STAGE2=${q1}&pageNo=1&numOfRows=100&_type=json`, fetchOptions);
                    const data = await res.json();
                    if (data.response?.body?.items?.item) {
                        const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                        return items.map((item: any) => ({
                            api_source: 'NMC_HOSPITAL', category: 'HOSPITAL',
                            name: item.dutyName, description: '응급실 가동 응급의료기관', address: item.dutyAddr,
                            lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                            trust_score: item.dutyName?.includes('소아') ? 100 : 50, raw_data: item
                        }));
                    }
                } catch (e) { console.error("NMC_HOSPITAL Task Error", e); }
                return [];
            })());

            // Festival
            apiTasks.push((async () => {
                try {
                    const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${publicApiKey}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${targetLng}&mapY=${targetLat}&radius=20000`, fetchOptions);
                    const data = await res.json();
                    if (data.response?.body?.items?.item) {
                        const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                        return items.filter((item: any) => isWithinServiceArea(parseFloat(item.mapy), parseFloat(item.mapx), targetLat, targetLng))
                            .map((item: any) => ({
                                api_source: 'TOUR_FSTVL', category: 'FESTIVAL',
                                name: item.title, description: '주변 로컬 축제/이벤트', address: item.addr1,
                                lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 80, raw_data: item
                            }));
                    }
                } catch (e) { console.error("TOUR_FSTVL Task Error", e); }
                return [];
            })());

            // Gas
            apiTasks.push((async () => {
                try {
                    const OPINET_API_KEY = process.env.OPINET_API_KEY;
                    if (OPINET_API_KEY) {
                        proj4.defs("EPSG:5181", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");
                        const [wtmX, wtmY] = proj4("EPSG:4326", "EPSG:5181", [targetLng, targetLat]);
                        const res = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX)}&y=${Math.round(wtmY)}&radius=5000&sort=1&prodcd=C004&out=json`, fetchOptions);
                        const data = await res.json();
                        if (data.RESULT?.OIL) {
                            const items = Array.isArray(data.RESULT.OIL) ? data.RESULT.OIL : [data.RESULT.OIL];
                            return items.filter((item: any) => item.K_PRICE > 0)
                                .sort((a: any, b: any) => a.K_PRICE - b.K_PRICE)
                                .slice(0, 3)
                                .map((item: any) => ({
                                    id: generateFactId('OPINET_GAS', item.OS_NM, item.VAN_ADR || '주소없음'), 
                                    api_source: 'OPINET_GAS', category: 'GAS',
                                    name: item.OS_NM, description: `등유: ${item.K_PRICE}원 (최저가 순)`, address: item.VAN_ADR || '주소 정보 없음',
                                    lat: targetLat, lng: targetLng, trust_score: 90, raw_data: item
                                }));
                        }
                    }
                } catch (e) { console.error("OPINET_GAS Task Error", e); }
                return [];
            })());

            const initialResults = await Promise.all(apiTasks);
            allFacts.push(...initialResults.flat());

            // 4. Phase 12: Kakao Enrichment (Weather-Aware Parallel Processing)
            const categoriesToEnrich: ('RESTAURANT' | 'MART' | 'SPOT' | 'HOSPITAL' | 'FESTIVAL')[] = ['HOSPITAL', 'FESTIVAL', 'RESTAURANT', 'SPOT', 'MART'];
            
            // Weather pre-fetch for the cluster
            let isRaining = false;
            try {
                const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0;
                const OLAT = 38.0, OLON = 126.0, XO = 43, YO = 136, DEGRAD = Math.PI / 180.0;
                const re = RE / GRID, slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD;
                const sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5));
                const sf = Math.pow(Math.tan(Math.PI * 0.25 + slat1 * 0.5), sn) * Math.cos(slat1) / sn;
                const ro = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + OLAT * DEGRAD * 0.5), sn);
                const ra = re * sf / Math.pow(Math.tan(Math.PI * 0.25 + targetLat * DEGRAD * 0.5), sn);
                let theta = targetLng * DEGRAD - OLON * DEGRAD;
                if (theta > Math.PI) theta -= 2.0 * Math.PI; if (theta < -Math.PI) theta += 2.0 * Math.PI;
                theta *= sn;
                const gridNx = Math.floor(ra * Math.sin(theta) + XO + 0.5);
                const gridNy = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
                const forecastRes = await fetch(`http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${publicApiKey}&numOfRows=10&pageNo=1&base_date=${new Date().toISOString().split('T')[0].replace(/-/g, '')}&base_time=0500&nx=${gridNx}&ny=${gridNy}&_type=json`);
                const weatherData = await forecastRes.json();
                isRaining = JSON.stringify(weatherData).includes('비') || JSON.stringify(weatherData).includes('소나기');
            } catch (e) { console.warn("Weather fetch failed, defaulting to sunny."); }

            for (const cat of categoriesToEnrich) {
                if (Date.now() - startTime > TIMEOUT_LIMIT) break;

                try {
                    let candidates = [];
                    if (cat === 'HOSPITAL') candidates = initialResults[0];
                    else if (cat === 'FESTIVAL') candidates = initialResults[1];
                    else {
                        const { data: dbItems } = await supabase.rpc('get_master_places_in_radius', {
                            target_lat: targetLat, target_lng: targetLng, radius_meters: 20000, limit_count: 50
                        });
                        if (dbItems) candidates = dbItems.filter((c: any) => c.category === cat);
                    }

                    if (candidates && candidates.length > 0) {
                        const filteredCandidates = candidates
                            .map((c: any) => {
                                let weatherWeight = 0;
                                if (isRaining) {
                                    if (c.name.includes('탕') || c.name.includes('찌개') || c.name.includes('전골')) weatherWeight += 20;
                                    if (c.description?.includes('실내') || c.description?.includes('박물관')) weatherWeight += 20;
                                }
                                return { ...c, temp_score: (c.trust_score || 0) + weatherWeight };
                            })
                            .sort((a: any, b: any) => b.temp_score - a.temp_score)
                            .slice(0, 5); // Reduce to 5 for speed (Safety Margin)

                        // Parallel enrichment for top 5 candidates
                        const enrichedResults = await Promise.all(filteredCandidates.map(async (cand: any) => {
                            const kakaoKey = process.env.KAKAO_REST_API_KEY;
                            if (!kakaoKey) return null;

                            try {
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
                                    return {
                                        id: generateFactId('MASTER_ENRICHED', cand.name, cand.address), 
                                        api_source: 'MASTER_ENRICHED', category: cand.category,
                                        name: cand.name, address: cand.address, lat: cand.lat, lng: cand.lng,
                                        trust_score: Math.min(finalScore, 100),
                                        description: scResult.success ? `${cand.description} (별점: ${scResult.rating}, 리뷰: ${scResult.reviewCount}건)` : cand.description,
                                        raw_data: { ...cand.raw_data, kakao_url: matched.place_url, scraping: scResult }
                                    };
                                }
                            } catch (matchErr) { /* fallback to original */ }

                            return {
                                id: generateFactId(cand.api_source || cand.category, cand.name, cand.address),
                                api_source: cand.api_source || cand.category,
                                category: cand.category, name: cand.name, address: cand.address, lat: cand.lat, lng: cand.lng,
                                trust_score: cand.trust_score || 50, description: cand.description || '', raw_data: { ...cand.raw_data, kakao_matched: false }
                            };
                        }));

                        const validEnriched = enrichedResults.filter(Boolean) as SmartPlanFact[];
                        const top3 = validEnriched.sort((a, b) => b.trust_score - a.trust_score).slice(0, 3);
                        allFacts.push(...top3);
                    }
                } catch (e: any) { console.error(`${cat} Enrichment Error`, e); }
            }
        }

        // 8. DB Save (Upsert)
        const validFacts = allFacts.filter(f => f.name && !isNaN(f.lat) && !isNaN(f.lng));
        let processedCount = 0;

        // [Phase 12 Extension] 영구 자산화 정책: 4일 TTL 삭제 로직 제거 (주석 처리)
        // const obsoleteDate = new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString();
        // await supabase.from('smart_plan_facts').delete().lt('created_at', obsoleteDate);

        if (validFacts.length > 0) {
            const { error } = await supabase.from('smart_plan_facts').upsert(validFacts);
            if (!error) processedCount = validFacts.length;
            else console.error("Upsert Error", error);
        }

        // 9. Log Automation Result
        const duration = Date.now() - startTime;
        await supabase.from('automation_logs').insert({
            job_name: 'SMART_PLAN_CACHING',
            status: processedCount > 0 ? 'SUCCESS' : 'FAILURE',
            processed_count: processedCount,
            message: `Processed ${clusters.length} clusters in ${duration}ms`,
            duration_ms: duration,
            target_date: targetStr
        });

        return new Response(JSON.stringify({ success: true, processed_count: processedCount, clusters: clusters.length, duration_ms: duration }), { status: 200 });
    } catch (error: any) {
        console.error("CRITICAL_CRON_ERROR", error);
        try {
            const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
            await supabase.from('automation_logs').insert({
                job_name: 'SMART_PLAN_CACHING',
                status: 'FAILURE',
                message: `CRITICAL_ERROR: ${error.message || 'Unknown error'}`,
                processed_count: 0
            });
        } catch (logErr) { console.error("FAILED_TO_LOG_ERROR", logErr); }
        return new Response(JSON.stringify({ error: error.message || 'Error' }), { status: 500 });
    }
}
