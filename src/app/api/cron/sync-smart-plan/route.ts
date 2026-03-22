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
                }
            }

            if (!targetLat || !targetLng) continue;

            let found = false;
            for (const c of clusters) {
                const dist = Math.sqrt(Math.pow(c.lat - targetLat, 2) + Math.pow(c.lng - targetLng, 2));
                if (dist <= 0.2) { 
                    if (!c.names.includes(s.campground_name)) c.names.push(s.campground_name);
                    found = true; break;
                }
            }
            if (!found) {
                clusters.push({ lat: targetLat, lng: targetLng, names: [s.campground_name], address: s.campground_address || '충청남도 예산군' });
            }
        }

        if (clusters.length === 0 && !manualTargetLat) {
            await supabase.from('automation_logs').insert({ job_name: 'SMART_PLAN_CACHING', status: 'SUCCESS', processed_count: 0, message: 'No targets. Skipped.', target_date: targetStr });
            return new Response(JSON.stringify({ success: true, message: 'No targets.' }), { status: 200 });
        } else if (manualTargetLat) {
            clusters.push({ lat: manualTargetLat, lng: manualTargetLng!, names: ['Manual'], address: manualAddress || '충청남도 예산군' });
        }

        const fetchOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } };
        const generateFactId = (source: string, name: string, address: string) => uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);

        const allFacts: any[] = [];
        const clusterLogs: any[] = [];
        const startTime = Date.now();
        const TIMEOUT_LIMIT = (maxDuration - 30) * 1000;

        for (let i = 0; i < clusters.length; i++) {
            if (Date.now() - startTime > TIMEOUT_LIMIT) break;

            const cluster = clusters[i];
            const targetLat = cluster.lat;
            const targetLng = cluster.lng;
            const addrParts = cluster.address.split(' ');
            const doNm = addrParts[0] || '충청남도';
            const sigunguNm = addrParts[1] || '예산군';

            // ==========================================
            // Step A. Raw Dynamic Data Fetch & Upsert (Organic Growth)
            // ==========================================
            const tracking: any = { stepA_dynamic: { HOSPITAL: 0, FESTIVAL: 0, GAS_STATION: 0 }, stepB_filter: {}, stepC_kakao_attempts: 0, stepC_kakao_success: 0, stepD_upsert: 0 };
            clusterLogs.push(tracking);
            const rawMasterInserts: any[] = [];

            // A-1. Hospital (Local City Fetch)
            try {
                const res = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent(doNm)}&STAGE2=${encodeURIComponent(sigunguNm)}&pageNo=1&numOfRows=100&_type=json`, fetchOptions);
                const data = await res.json();
                if (data.response?.body?.items?.item) {
                    const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                    items.forEach((item: any) => {
                        rawMasterInserts.push({
                            id: generateFactId('NMC_HOSPITAL', item.dutyName, item.dutyAddr),
                            api_source: 'NMC_HOSPITAL', category: 'HOSPITAL',
                            name: item.dutyName, description: '응급실 가동 응급의료기관', address: item.dutyAddr,
                            lat: parseFloat(item.wgs84Lat), lng: parseFloat(item.wgs84Lon),
                            trust_score: item.dutyName?.includes('소아') ? 100 : 55, raw_data: item
                        });
                    });
                    tracking.stepA_dynamic.HOSPITAL = items.length;
                }
            } catch (e) { console.error("Hospital Fetch Error"); }

            // A-2. Festival
            try {
                const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${publicApiKey}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${targetLng}&mapY=${targetLat}&radius=20000`, fetchOptions);
                const data = await res.json();
                if (data.response?.body?.items?.item) {
                    const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                    items.forEach((item: any) => {
                        rawMasterInserts.push({
                            id: generateFactId('TOUR_FSTVL', item.title, item.addr1),
                            api_source: 'TOUR_FSTVL', category: 'FESTIVAL',
                            name: item.title, description: '주변 로컬 축제/이벤트', address: item.addr1,
                            lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 45, raw_data: item
                        });
                    });
                    tracking.stepA_dynamic.FESTIVAL = items.length;
                }
            } catch (e) { console.error("Festival Fetch Error"); }

            // A-3. Gas Station (Multi-call 10km bounds via Katec EPSG:5181)
            try {
                const OPINET_API_KEY = process.env.OPINET_API_KEY;
                if (OPINET_API_KEY) {
                    proj4.defs("EPSG:5181", "+proj=tmerc +lat_0=38 +lon_0=127 +k=1 +x_0=200000 +y_0=500000 +ellps=GRS80 +units=m +no_defs");
                    const [wtmX, wtmY] = proj4("EPSG:4326", "EPSG:5181", [targetLng, targetLat]);
                    const shifts = [{x:0,y:0}, {x:5000,y:0}, {x:-5000,y:0}, {x:0,y:5000}, {x:0,y:-5000}]; // 5km shifts
                    
                    const gasPromises = shifts.map(s => 
                        fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX+s.x)}&y=${Math.round(wtmY+s.y)}&radius=5000&sort=1&prodcd=C004&out=json`, fetchOptions)
                        .then(r=>r.json()).catch(()=>null)
                    );
                    const gasResults = await Promise.all(gasPromises);
                    const seenGas = new Set();

                    gasResults.forEach(data => {
                        if (data?.RESULT?.OIL) {
                            const items = Array.isArray(data.RESULT.OIL) ? data.RESULT.OIL : [data.RESULT.OIL];
                            items.forEach((item: any) => {
                                const key = item.OS_NM + item.VAN_ADR;
                                if (!seenGas.has(key) && item.K_PRICE > 0) {
                                    seenGas.add(key);
                                    const [lon, lat] = proj4("EPSG:5181", "EPSG:4326", [parseFloat(item.GIS_X_COOR), parseFloat(item.GIS_Y_COOR)]);
                                    rawMasterInserts.push({
                                        id: generateFactId('OPINET_GAS', item.OS_NM, item.VAN_ADR || '주소없음'),
                                        api_source: 'OPINET_GAS', category: 'GAS_STATION',
                                        name: item.OS_NM, description: `등유: ${item.K_PRICE}원`, address: item.VAN_ADR || '주소 정보 없음',
                                        lat: lat, lng: lon, trust_score: 55, raw_data: item
                                    });
                                }
                            });
                        }
                    });
                    tracking.stepA_dynamic.GAS_STATION = seenGas.size;
                }
            } catch (e) { console.error("Gas Fetch Error"); }

            // Upsert Raw Data to master_places for permanent retention
            if (rawMasterInserts.length > 0) {
                const uniqueRaw = Object.values(rawMasterInserts.reduce((acc: any, row: any) => ({ ...acc, [row.id]: row }), {})) as any[];
                await supabase.from('master_places').upsert(uniqueRaw, { onConflict: 'id' });
            }


            // ==========================================
            // Step B. 1차 선별 (1st Filtering) - Pure Facts Only
            // ==========================================
            // Get all candidates around cluster from master_places (now including the freshly upserted dynamic ones)
            const { data: dbItems } = await supabase.rpc('get_master_places_in_radius', {
                target_lat: targetLat, target_lng: targetLng, radius_meters: 30000, limit_count: 500
            });
            const candidates = dbItems || [];

            // Helper: WGS84 Distance (km)
            const getDist = (lat: number, lng: number) => {
                const R = 6371; const dLat = (lat - targetLat) * Math.PI / 180; const dLon = (lng - targetLng) * Math.PI / 180;
                const a = Math.sin(dLat/2) * Math.sin(dLat/2) + Math.cos(targetLat*Math.PI/180) * Math.cos(lat*Math.PI/180) * Math.sin(dLon/2) * Math.sin(dLon/2);
                return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
            };
            candidates.forEach((c: any) => c._dist = getDist(c.lat, c.lng));

            const selectedCandidates: any[] = [];
            ['MART', 'SPOT', 'FESTIVAL', 'HOSPITAL', 'GAS_STATION', 'RESTAURANT'].forEach(cat => {
                tracking.stepB_filter[cat] = { discovered: candidates.filter((c:any) => c.category === cat).length, passed_formula: 0 };
            });

            // 1) MART (Brand Score + Area + Distance)
            const marts = candidates.filter((c:any) => c.category === 'MART').map((c:any) => {
                let s = 0;
                if (c.name.match(/이마트|홈플러스|롯데마트|트레이더스|에브리데이|익스프레스/)) s += 50;
                else if (c.name.match(/하나로마트|탑마트|메가마트|농협/)) s += 40;
                else if (c.name.match(/식자재|도매|마트/)) s += 20;
                const ar = c.raw_data?.ar ? parseFloat(c.raw_data.ar) : 0;
                if (ar > 3000) s += 10; else if (ar > 1000) s += 5;
                s += Math.max(0, (1 - (c._dist / 20.0)) * 40);
                return { ...c, _sortScore: s };
            }).sort((a:any, b:any) => b._sortScore - a._sortScore).slice(0, 15);
            selectedCandidates.push(...marts);
            tracking.stepB_filter['MART'].passed_formula = marts.length;

            // 2) SPOT, FESTIVAL, HOSPITAL (Distance DESC)
            ['SPOT', 'FESTIVAL', 'HOSPITAL'].forEach(cat => {
                const list = candidates.filter((c:any) => c.category === cat)
                                       .sort((a:any, b:any) => a._dist - b._dist)
                                       .slice(0, 15);
                selectedCandidates.push(...list);
                tracking.stepB_filter[cat].passed_formula = list.length;
            });

            // 3) GAS_STATION (Price ASC -> Distance)
            const gasFiltered = candidates.filter((c:any) => c.category === 'GAS_STATION').sort((a:any, b:any) => {
                const pA = a.raw_data?.K_PRICE ? parseFloat(a.raw_data.K_PRICE) : 99999;
                const pB = b.raw_data?.K_PRICE ? parseFloat(b.raw_data.K_PRICE) : 99999;
                if (pA === pB) return a._dist - b._dist;
                return pA - pB;
            }).slice(0, 10);
            selectedCandidates.push(...gasFiltered);
            tracking.stepB_filter['GAS_STATION'].passed_formula = gasFiltered.length;

            // 4) RESTAURANT (Trust Score DESC -> Distance)
            const rests = candidates.filter((c:any) => c.category === 'RESTAURANT').sort((a:any, b:any) => {
                const tA = a.trust_score || 0; const tB = b.trust_score || 0;
                if (tA === tB) return a._dist - b._dist;
                return tB - tA;
            }).slice(0, 20);
            selectedCandidates.push(...rests);
            tracking.stepB_filter['RESTAURANT'].passed_formula = rests.length;


            // ==========================================
            // Step C. Kakao Enrichment (Phase 12)
            // ==========================================
            // Proceed to enrich the perfectly curated `selectedCandidates` array.
            const categoriesToEnrich = ['HOSPITAL', 'FESTIVAL', 'RESTAURANT', 'SPOT', 'MART', 'GAS_STATION'];

            for (const cat of categoriesToEnrich) {
                if (Date.now() - startTime > TIMEOUT_LIMIT) break;
                
                const catCands = selectedCandidates.filter(c => c.category === cat);
                if (catCands.length === 0) continue;

                // For stability in serverless, we process in chunks or handle them all in parallel
                const enrichedResults = await Promise.all(catCands.map(async (cand: any) => {
                    const kakaoKey = process.env.KAKAO_REST_API_KEY;
                    if (!kakaoKey) return null;

                    try {
                        const kRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cand.name)}&x=${cand.lng}&y=${cand.lat}&radius=2000`, { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } });
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
                                description: scResult.success ? `${cand.description || ''} (별점: ${scResult.rating}, 리뷰: ${scResult.reviewCount}건)` : (cand.description || ''),
                                raw_data: { ...cand.raw_data, kakao_url: matched.place_url, scraping: scResult }
                            };
                        }
                    } catch (err) { /* fallback */ }

                    return {
                        id: cand.id, api_source: cand.api_source, category: cand.category,
                        name: cand.name, address: cand.address, lat: cand.lat, lng: cand.lng,
                        trust_score: cand.trust_score || 50, description: cand.description || '', raw_data: { ...cand.raw_data, kakao_matched: false }
                    };
                }));

                const validEnriched = enrichedResults.filter(Boolean) as any[];
                allFacts.push(...validEnriched);
                tracking.stepC_kakao_attempts += catCands.length;
                tracking.stepC_kakao_success += validEnriched.length;
            }
        }

        // ==========================================
        // Step D. DB Save to smart_plan_facts (Permanent Cache)
        // ==========================================
        const validFacts = allFacts.filter(f => f.name && !isNaN(f.lat) && !isNaN(f.lng));
        let processedCount = 0;

        if (validFacts.length > 0) {
            const uniqueFacts = Object.values(validFacts.reduce((acc: any, row: any) => ({ ...acc, [row.id]: row }), {})) as any[];
            const { error } = await supabase.from('smart_plan_facts').upsert(uniqueFacts, { onConflict: 'id' });
            if (!error) {
                processedCount = uniqueFacts.length;
            }
            else console.error("Upsert Facts Error", error);
        }

        const duration = Date.now() - startTime;
        await supabase.from('automation_logs').insert({
            job_name: 'SMART_PLAN_CACHING',
            status: processedCount > 0 ? 'SUCCESS' : 'FAILURE',
            processed_count: processedCount,
            message: JSON.stringify({ clusters: clusterLogs, final_upsert: processedCount }),
            duration_ms: duration,
            target_date: targetStr
        });

        return new Response(JSON.stringify({ success: true, processed_count: processedCount, clusters: clusters.length, duration_ms: duration }), { status: 200 });
    } catch (error: any) {
        console.error("CRITICAL_CRON_ERROR", error);
        return new Response(JSON.stringify({ error: error.message || 'Error' }), { status: 500 });
    }
}
