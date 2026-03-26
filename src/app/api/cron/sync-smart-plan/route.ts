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

        let manualTargetLat: number | null = null;
        let manualTargetLng: number | null = null;
        let manualAddress: string | null = null;
        let manualTargetDate: string | null = null;

        try {
            const body = await request.json();
            if (body.targetLat && body.targetLng) {
                manualTargetLat = body.targetLat;
                manualTargetLng = body.targetLng;
                manualAddress = body.targetRegion || '충청남도 예산군';
            }
            if (body.targetDate) {
                manualTargetDate = body.targetDate;
            }
        } catch (e) { /* ignore GET or JSON parsing error */ }

        const now = new Date();
        const kstNow = new Date(now.getTime() + (9 * 60 * 60 * 1000));
        const targetDate = new Date(kstNow);
        targetDate.setDate(kstNow.getDate() + 3);
        const targetStr = manualTargetDate || targetDate.toISOString().split('T')[0];

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
        const totalTracking: any = {
            stepA_dynamic: { HOSPITAL: 0, FESTIVAL: 0, GAS_STATION: 0 },
            stepB_filter: { MART: 0, SPOT: 0, FESTIVAL: 0, HOSPITAL: 0, GAS_STATION: 0, RESTAURANT: 0 },
            stepC_kakao_attempts: 0,
            stepC_kakao_success: 0,
            stepD_upsert: 0
        };
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

            // A-1-2. Kakao Local Hospital Fetch (HP8) - Radius 20km
            try {
                const kakaoKey = process.env.KAKAO_REST_API_KEY;
                if (kakaoKey) {
                    const res = await fetch(`https://dapi.kakao.com/v2/local/search/category.json?category_group_code=HP8&x=${targetLng}&y=${targetLat}&radius=20000&size=15`, { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } });
                    const data = await res.json();
                    if (data.documents) {
                        data.documents.forEach((item: any) => {
                            rawMasterInserts.push({
                                id: generateFactId('KAKAO_HP8', item.place_name, item.road_address_name || item.address_name),
                                api_source: 'KAKAO_HP8', category: 'HOSPITAL',
                                name: item.place_name, description: item.category_name || '일반 병원/의원', address: item.road_address_name || item.address_name,
                                lat: parseFloat(item.y), lng: parseFloat(item.x),
                                trust_score: item.place_name?.match(/종합병원|의료원|대학병원/) ? 50 : 20, raw_data: item
                            });
                        });
                        tracking.stepA_dynamic.HOSPITAL += data.documents.length;
                    }
                }
            } catch (e) { console.error("Kakao HP8 Error"); }

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

            // A-3. Gas Station (Multi-call Spiral Search constraints up to 30km)
            try {
                const OPINET_API_KEY = process.env.OPINET_API_KEY;
                if (OPINET_API_KEY) {
                    proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");
                    const [wtmX, wtmY] = proj4("EPSG:4326", "TM128", [targetLng, targetLat]);
                    const seenGas = new Set();
                    
                    const spiralShifts = [
                        [{x:0, y:0}],
                        [{x:10000,y:0}, {x:-10000,y:0}, {x:0,y:10000}, {x:0,y:-10000}],
                        [{x:20000,y:0}, {x:-20000,y:0}, {x:0,y:20000}, {x:0,y:-20000}, {x:15000,y:15000}, {x:-15000,y:15000}, {x:15000,y:-15000}, {x:-15000,y:-15000}],
                        [{x:30000,y:0}, {x:-30000,y:0}, {x:0,y:30000}, {x:0,y:-30000}]
                    ];

                    for (const group of spiralShifts) {
                        if (seenGas.size >= 5) break; 
                        const gasPromises = group.map(s => {
                            const url = `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX+s.x)}&y=${Math.round(wtmY+s.y)}&radius=5000&sort=1&prodcd=C004&out=json`;
                            console.log(`[Opinet Probe] Radius Shift: ${s.x}, ${s.y} | URL: ${url}`);
                            return fetch(url, fetchOptions)
                            .then(async r => {
                                const d = await r.json();
                                return d;
                            }).catch(err => {
                                console.error("OPINET Fetch Error:", err.message);
                                return null;
                            });
                        });
                        const gasResults = await Promise.all(gasPromises);
                        const gasInserts: any[] = [];
                        gasResults.forEach(data => {
                            if (data?.RESULT?.OIL) {
                                const items = Array.isArray(data.RESULT.OIL) ? data.RESULT.OIL : [data.RESULT.OIL];
                                items.forEach((item: any) => {
                                    const key = (item.OS_NM || 'NONE') + (item.VAN_ADR || 'ADDR');
                                    const price = parseFloat(item.PRICE || item.K_PRICE || "0");
                                    if (!seenGas.has(key) && price > 0) {
                                        seenGas.add(key);
                                        // TM128 → WGS84 좌표 변환 (매뉴얼 4.4 좌표계 표준화)
                                        const [lon, lat] = proj4("TM128", "EPSG:4326", [parseFloat(item.GIS_X_COOR), parseFloat(item.GIS_Y_COOR)]);
                                        // 주소 폴백 체인: VAN_ADR → NEW_ADR → 역지오코딩 대기
                                        const rawAddr = item.VAN_ADR || item.NEW_ADR || '';
                                        gasInserts.push({
                                            id: generateFactId('OPINET_GAS', item.OS_NM, rawAddr || '주소없음'),
                                            api_source: 'OPINET_GAS', category: 'GAS_STATION',
                                            name: item.OS_NM, description: `등유: ${price}원`, address: rawAddr,
                                            lat: lat, lng: lon, trust_score: 55, raw_data: item
                                        });
                                    }
                                });
                            }
                        });

                        // 주유소 주소 누락 보강: WGS84 좌표 → 카카오 역지오코딩
                        const kakaoKey = process.env.KAKAO_REST_API_KEY;
                        for (const gas of gasInserts) {
                            if (!gas.address && kakaoKey && gas.lat && gas.lng) {
                                try {
                                    const revGeoRes = await fetch(
                                        `https://dapi.kakao.com/v2/local/geo/coord2address.json?x=${gas.lng}&y=${gas.lat}`,
                                        { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } }
                                    );
                                    const revGeoData = await revGeoRes.json();
                                    if (revGeoData.documents?.[0]) {
                                        const doc = revGeoData.documents[0];
                                        gas.address = doc.road_address?.address_name || doc.address?.address_name || '';
                                        gas.id = generateFactId('OPINET_GAS', gas.name, gas.address || '주소없음');
                                    }
                                } catch (e) { /* 역지오코딩 실패 시 skip */ }
                            }
                            rawMasterInserts.push(gas);
                        }
                    }
                    tracking.stepA_dynamic.GAS_STATION = seenGas.size;
                }
            } catch (e) { console.error("Gas Fetch Error"); }

            // Upsert Raw Data to master_places for permanent retention
            if (rawMasterInserts.length > 0) {
                const uniqueRaw = Object.values(rawMasterInserts.reduce((acc: any, row: any) => ({ ...acc, [row.id]: row }), {})) as any[];
                const { error: masterUpsertError } = await supabase.from('master_places').upsert(uniqueRaw, { onConflict: 'id' });
                
                if (masterUpsertError) {
                    console.error('[master_places upsert FAILED]', masterUpsertError.message, masterUpsertError.details);
                    // 개별 건 재시도 (Fallback: 1건씩 upsert)
                    let recoveredCount = 0;
                    for (const row of uniqueRaw) {
                        const { error: singleErr } = await supabase.from('master_places').upsert([row], { onConflict: 'id' });
                        if (!singleErr) recoveredCount++;
                    }
                    console.log(`[master_places recovery] ${recoveredCount}/${uniqueRaw.length} recovered`);
                    tracking.stepA_master_upsert = { attempted: uniqueRaw.length, failed: true, recovered: recoveredCount };
                    tracking.stepA_master_upsert = { attempted: uniqueRaw.length, failed: false, recovered: uniqueRaw.length };
                }
            }


            // ==========================================
            // Step B. 1차 선별 (1st Filtering) - Pure Facts Only
            // ==========================================
            // Fetch dynamically via explicit category quotas. 
            const categories = [
                { cat: 'RESTAURANT', limit: 1000 },
                { cat: 'MART', limit: 100 },
                { cat: 'SPOT', limit: 100 },
                { cat: 'FESTIVAL', limit: 100 },
                { cat: 'HOSPITAL', limit: 100 },
                { cat: 'GAS_STATION', limit: 100 }
            ];
            
            const candidates: any[] = [];
            await Promise.all(categories.map(async ({ cat, limit }) => {
                const { data } = await supabase.rpc('get_master_places_in_radius', {
                    target_lat: targetLat, target_lng: targetLng, radius_meters: 30000, limit_count: limit, p_category: cat
                });
                if (data) candidates.push(...data);
            }));

            // Include freshly fetched dynamic records (HOSPITALS, FESTIVALS, GAS) directly to bypass PostGIS indexing delay
            if (rawMasterInserts && rawMasterInserts.length > 0) {
                const uniqueRaw = Object.values(rawMasterInserts.reduce((acc: any, row: any) => ({ ...acc, [row.id]: row }), {})) as any[];
                candidates.push(...uniqueRaw);
            }

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

            // 1) MART (Brand Score + Distance + Noise Filter)
            const marts = candidates.filter((c:any) => {
                if (c.category !== 'MART') return false;
                // Noise Filter: 비식료품 대형점포 제외 (SSOT v10.3)
                const isNoise = /패션|아울렛|의류|슈즈|전자|하이마트|가구|침대|웨딩|시마을|전시장|백화점|쇼핑블럭|시장/.test(c.name);
                return !isNoise;
            }).map((c:any) => {
                let s = 60; // Base score for Mart
                const name = c.name.toUpperCase();
                // Brand Weights (SSOT v10.3 - Refined for Proximity)
                if (/하나로마트|NH농협|농협마트/.test(name)) s = 80;
                else if (/이마트|롯데마트|홈플러스|노브랜드|트레이더스/.test(name)) s = 75;
                else if (/GS THE FRESH|GS더프레시|이마트에브리데이|홈플러스익스프레스|식자재마트/.test(name)) s = 65;
                
                // Distance Weight (Max 60pts, Radius 15km - Linear Penalty beyond 15km)
                const distScore = (1 - (c._dist / 15.0)) * 60;
                return { ...c, _sortScore: s + distScore };
            }).sort((a:any, b:any) => b._sortScore - a._sortScore).slice(0, 15);

            selectedCandidates.push(...marts);
            tracking.stepB_filter['MART'].passed_formula = marts.length;

            // 2) HOSPITAL (Hierarchy + Distance + Noise Filter)
            const hospitals = candidates.filter((c:any) => {
                if (c.category !== 'HOSPITAL') return false;
                // Noise Filter: 동물병원, 정신병원, 단순 관공서 등 제외
                const isNoise = /동물|반려|정신|행정관|피부|치과|요양|성형/.test(c.name);
                return !isNoise;
            }).map((c:any) => {
                let s = 20; // Default base
                const name = c.name;
                // Hierarchy Scoring (Proposal v10)
                if (c.api_source?.includes('NMC') || /종합병원|의료원/.test(name)) s = 100;
                else if (/내과|소아과|외과|가정의학/.test(name)) s = 70;
                else if (/보건소|보건지소/.test(name)) s = 50;
                
                // Distance Weight (Max 50pts, Radius 30km)
                const distScore = Math.max(0, (1 - (c._dist / 30.0)) * 50); 
                return { ...c, _sortScore: s + distScore };
            }).sort((a:any, b:any) => b._sortScore - a._sortScore).slice(0, 15);
            selectedCandidates.push(...hospitals);
            tracking.stepB_filter['HOSPITAL'].passed_formula = hospitals.length;

            // 3) SPOT, FESTIVAL (Distance DESC)
            ['SPOT', 'FESTIVAL'].forEach(cat => {
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

            // 4) RESTAURANT (Multi-Auth Bonus + Distance + Noise Filter)
            const rests = candidates.filter((c:any) => {
                if (c.category !== 'RESTAURANT') return false;
                // Noise Filter: 비음식점 백년가게 등 제외
                const isNoise = /안경|의상|한복|건축|이용원|이발|미용/.test(c.name);
                return !isNoise;
            }).map((c:any) => {
                // Multi-Auth Bonus Calculation (Manual Step 3)
                const sources = (c.api_source || '').split(',').map((s:string) => s.trim());
                let s = 60; // Standard base
                if (sources.length >= 3) s = 100; // 3+ API overlap (+30 bonus)
                else if (sources.length === 2) s = 85; // 2 API overlap (+15 bonus)
                else if (sources.includes('SMBA_BAEK') || sources.includes('LOCALDATA_RESTAURANT')) s = 70; // Certified standard
                
                // Distance Weight (Max 40pts, Radius 15km)
                const distScore = Math.max(0, (1 - (c._dist / 15.0)) * 40);
                return { ...c, _sortScore: s + distScore };
            }).sort((a:any, b:any) => b._sortScore - a._sortScore).slice(0, 20);
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
                        let kRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cand.name)}&x=${cand.lng}&y=${cand.lat}&radius=2000`, { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } });
                        let kData = await kRes.json();
                        
                        // Fallback: If 2km search fails, try 10km (relaxed for verified entities with coordinate drift)
                        if (!kData.documents || kData.documents.length === 0) {
                             kRes = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(cand.name)}&x=${cand.lng}&y=${cand.lat}&radius=10000`, { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } });
                             kData = await kRes.json();
                        }

                        const matched = kData.documents?.find((d:any) => d.place_name.replace(/\s/g,'') === cand.name.replace(/\s/g,'')) || kData.documents?.[0];


                        if (matched && matched.place_url) {
                            const scResult = await scrapeKakaoPlace(matched.place_url);
                            let finalScore = (cand.trust_score || 50);
                            
                            return {
                                id: generateFactId('MASTER_ENRICHED', cand.name, cand.address), 
                                api_source: 'MASTER_ENRICHED', category: cand.category,
                                name: cand.name, address: cand.address, lat: cand.lat, lng: cand.lng,
                                trust_score: finalScore, // Removed 100-point cap (v3.2 refinement)
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
                
                // Aggregation to totalTracking
                totalTracking.stepC_kakao_attempts += catCands.length;
                totalTracking.stepC_kakao_success += validEnriched.length;
            }

            // Aggregate Category Breakdown (Step B)
            for (const cat in tracking.stepB_filter) {
                totalTracking.stepB_filter[cat] = (totalTracking.stepB_filter[cat] || 0) + (tracking.stepB_filter[cat]?.passed_formula || 0);
            }
            // Aggregate Step A
            for (const cat in tracking.stepA_dynamic) {
                totalTracking.stepA_dynamic[cat] += tracking.stepA_dynamic[cat];
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
            message: JSON.stringify({ 
                clusters: clusterLogs, 
                final_upsert: processedCount,
                metrics: {
                    user_total: (schedules?.length || 0),
                    regions_merged: clusters.length,
                    category_breakdown: totalTracking.stepB_filter,
                    kakao_stats: {
                        attempts: totalTracking.stepC_kakao_attempts,
                        success: totalTracking.stepC_kakao_success
                    },
                    stepA_total: totalTracking.stepA_dynamic
                }
            }),
            duration_ms: duration,
            target_date: targetStr
        });

        return new Response(JSON.stringify({ success: true, processed_count: processedCount, clusters: clusters.length, duration_ms: duration }), { status: 200 });
    } catch (error: any) {
        console.error("CRITICAL_CRON_ERROR", error);
        return new Response(JSON.stringify({ error: error.message || 'Error' }), { status: 500 });
    }
}
