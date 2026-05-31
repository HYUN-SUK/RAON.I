import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';

// Vercel Serverless Function Timeout 설정
export const maxDuration = 300;

// UUID v5 Namespace (Deterministic)
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// 카카오 지오코딩 헬퍼: 주소 → 위경도 변환 (이름/주소 다중 지원)
async function geocodeAddress(nameOrAddress: string, optAddress?: string): Promise<{ lat: number; lng: number; addr?: string } | null> {
    const kakaoKey = process.env.KAKAO_REST_API_KEY;
    if (!kakaoKey) return null;
    const name = optAddress ? nameOrAddress : '';
    const address = optAddress ? optAddress : nameOrAddress;
    if (!address && !name) return null;

    try {
        if (name) {
            // 1차 키워드 검색
            const query = address ? `${address.split(' ').slice(0, 3).join(' ')} ${name}` : name;
            const res = await fetch(`https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}&size=1`, {
                headers: { 'Authorization': `KakaoAK ${kakaoKey}` }
            });
            const data = await res.json();
            if (data.documents && data.documents.length > 0) {
                return {
                    lat: parseFloat(data.documents[0].y),
                    lng: parseFloat(data.documents[0].x),
                    addr: data.documents[0].road_address_name || data.documents[0].address_name
                };
            }
        }

        // 2차 주소 검색
        if (address) {
            const res = await fetch(
                `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
                { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } }
            );
            const data = await res.json();
            if (data.documents && data.documents.length > 0) {
                return {
                    lat: parseFloat(data.documents[0].y),
                    lng: parseFloat(data.documents[0].x),
                    addr: data.documents[0].road_address?.address_name || data.documents[0].address?.address_name || address
                };
            }
        }
        return null;
    } catch {
        return null;
    }
}

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
        const fetchOptions = { headers: { 'User-Agent': 'Mozilla/5.0' } };

        let targetCategory = 'ALL';
        try {
            const body = await request.json();
            if (body.targetCategory) targetCategory = body.targetCategory;
        } catch (e) { /* ignore GET or JSON parsing error */ }

        console.log(`[Master Sync Cron] Starting Weekly Full-Sync for: ${targetCategory}`);
        let totalInserted = 0;

        // 1. 관광 명소 (SPOT)
        if (targetCategory === 'ALL' || targetCategory === 'SPOT') {
            let pageNo = 1;
            let hasMore = true;
            while (hasMore && pageNo <= 30) {
                try {
                    const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${publicApiKey}&numOfRows=100&pageNo=${pageNo}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12`, fetchOptions);
                    const data = await res.json();
                    const items = data.response?.body?.items?.item;
                    if (items) {
                        const itemList = Array.isArray(items) ? items : [items];
                        
                        // [v10.5.2] Enrichment: Fetch Detailed Info (readcount, overview) in Chunks
                        const enrichedList = [];
                        for (let i = 0; i < itemList.length; i += 10) {
                            const batch = itemList.slice(i, i + 10);
                            const enriched = await Promise.all(batch.map(async (item: any) => {
                                try {
                                    // DetailCommon2 Call for rich meta
                                    const dRes = await fetch(`http://apis.data.go.kr/B551011/KorService2/detailCommon2?serviceKey=${publicApiKey}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentId=${item.contentid}&defaultYN=Y&overviewYN=Y&areacodeYN=Y&catcodeYN=Y&addrinfoYN=Y&mapinfoYN=Y&firstImageYN=Y`, fetchOptions);
                                    const dData = await dRes.json();
                                    const dItem = dData.response?.body?.items?.item;
                                    const detail = dItem ? (Array.isArray(dItem) ? dItem[0] : dItem) : {};
                                    return { ...item, ...detail }; // Merge enriched fields
                                } catch (err) { return item; }
                            }));
                            enrichedList.push(...enriched);
                        }

                        const chunk = enrichedList.map((item: any) => {
                            const name = item.title;
                            const addr = item.addr1 || item.addr2 || '';
                            return {
                                id: uuidv5(`TOUR_SPOT|${name}|${addr}`, MY_NAMESPACE),
                                api_source: 'TOUR_SPOT', category: 'SPOT',
                                name, 
                                description: item.overview || '한국관광공사 선정 관광명소', // Rich description applied
                                address: addr,
                                lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), 
                                trust_score: 40, raw_data: item,
                                sido: '', sigungu: ''
                            };
                        }).filter((i: any) => !isNaN(i.lat) && !isNaN(i.lng));

                        if (chunk.length > 0) {
                            const { error } = await supabase.from('master_places').upsert(chunk, { onConflict: 'id' });
                            if (!error) totalInserted += chunk.length;
                        }
                        pageNo++;
                        await new Promise(r => setTimeout(r, 500));
                    } else { hasMore = false; }
                } catch (e) { hasMore = false; }
            }
        }

        // 2. 대형마트 (MART)
        if (targetCategory === 'ALL' || targetCategory === 'MART') {
            let pageNo = 1;
            let hasMore = true;
            while (hasMore && pageNo <= 20) {
                try {
                    const res = await fetch(`https://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${publicApiKey}&pageNo=${pageNo}&numOfRows=100&returnType=json`, fetchOptions);
                    const data = await res.json();
                    const items = data.response?.body?.items?.item;
                    if (items) {
                        const itemList = Array.isArray(items) ? items : [items];
                        const chunk = [];
                        for (const item of itemList) {
                            const addr = item.RDNWHL_ADDR || item.LNM_ADDR || item.BPLC_NM || '';
                            if (!addr) continue;
                            const coords = await geocodeAddress(addr);
                            if (!coords) continue;
                            const name = item.BPLC_NM || item.STRNM || addr;
                            chunk.push({
                                id: uuidv5(`LARGE_STORE|${name}|${addr}`, MY_NAMESPACE),
                                api_source: 'LARGE_STORE', category: 'MART',
                                name, description: '행정안전부 등록 대규모 점포',
                                address: addr, lat: coords.lat, lng: coords.lng,
                                trust_score: 60, raw_data: item,
                                sido: item.CTPRVN_NM || '', sigungu: item.SIGNGU_NM || ''
                            });
                            await new Promise(r => setTimeout(r, 100));
                        }
                        if (chunk.length > 0) {
                            const { error } = await supabase.from('master_places').upsert(chunk, { onConflict: 'id' });
                            if (!error) totalInserted += chunk.length;
                        }
                        pageNo++;
                    } else { hasMore = false; }
                } catch (e) { hasMore = false; }
            }
        }

        // 3. 식당 (RESTAURANT - 백년가게)
        if (targetCategory === 'ALL' || targetCategory === 'RESTAURANT') {
            try {
                const specRes = await fetch(`https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent('15102255/v1')}`, fetchOptions);
                const spec = await specRes.json();
                const paths = Object.keys(spec.paths || {});
                if (paths.length > 0) {
                    let pageNo = 1;
                    while (pageNo <= 20) {
                        const res = await fetch(`https://api.odcloud.kr/api${paths[0]}?serviceKey=${publicApiKey}&page=${pageNo}&perPage=100`, fetchOptions);
                        const data = await res.json();
                        if (data.data && data.data.length > 0) {
                            const chunk = [];
                            for (const item of data.data) {
                                const addr = item['주소'] || '', name = item['업체명'];
                                if (!addr || !name) continue;
                                const coords = await geocodeAddress(addr);
                                if (!coords) continue;
                                chunk.push({
                                    id: uuidv5(`SMBA_BAEK|${name}|${addr}`, MY_NAMESPACE),
                                    api_source: 'SMBA_BAEK', category: 'RESTAURANT',
                                    name, description: `백년가게 공식 지정 (${item['업종'] || '식당'})`, address: addr,
                                    lat: coords.lat, lng: coords.lng, trust_score: 80, raw_data: item,
                                    sido: item['시도·시군구']?.split(' ')[0] || '', sigungu: item['시도·시군구']?.split(' ')[1] || ''
                                });
                                await new Promise(r => setTimeout(r, 100));
                            }
                            await supabase.from('master_places').upsert(chunk, { onConflict: 'id' });
                            totalInserted += chunk.length;
                            pageNo++;
                        } else break;
                    }
                }
            } catch (e) { console.error('RESTAURANT Sync Error', e); }
        }

        // 4. 응급의료기관 (HOSPITAL)
        if (targetCategory === 'ALL' || targetCategory === 'HOSPITAL') {
            try {
                const SIDO_LIST = [
                    '서울특별시', '부산광역시', '대구광역시', '인천광역시', '광주광역시', 
                    '대전광역시', '울산광역시', '세종특별자치시', '경기도', '강원특별자치도', 
                    '충청북도', '충청남도', '전북특별자치도', '전라남도', '경상북도', 
                    '경상남도', '제주특별자치도'
                ];
                
                const chunk: any[] = [];
                const generateFactId = (source: string, name: string, address: string) => 
                    uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);

                // Supabase에서 기존 모든 HOSPITAL 좌표 데이터 일괄 조회 (루프 밖에서 한 번만 수행하여 지오코딩 스킵 정확도 및 성능 극대화)
                const { data: existingHospitals } = await supabase
                    .from('master_places')
                    .select('id, lat, lng, address, name, raw_data')
                    .eq('category', 'HOSPITAL');

                const existingMap = new Map<string, { id: string, lat: number, lng: number, address: string, name: string }>();
                if (existingHospitals) {
                    existingHospitals.forEach(h => {
                        if (h.lat && h.lng) {
                            const val = { id: h.id, lat: h.lat, lng: h.lng, address: h.address || '', name: h.name || '' };
                            existingMap.set(h.id, val);
                            if (h.raw_data?.hpid) {
                                existingMap.set(h.raw_data.hpid, val);
                            }
                            if (h.name) {
                                existingMap.set(h.name, val);
                            }
                        }
                    });
                }

                for (const sido of SIDO_LIST) {
                    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent(sido)}&STAGE2=&pageNo=1&numOfRows=100&_type=json`;
                    const res = await fetch(url, fetchOptions);
                    const data = await res.json();
                    const items = data.response?.body?.items?.item;

                    if (items) {
                        const itemList = Array.isArray(items) ? items : [items];

                        for (const item of itemList) {
                            const hAddr = item.dutyAddr || '';
                            const tempFid = generateFactId('NMC_HOSPITAL', item.dutyName, hAddr);
                            
                            // id, hpid, name 순으로 기존 매핑 룩업 시도하여 주소 누락 시에도 좌표 매칭 성공 보장
                            const exist = existingMap.get(tempFid) || 
                                          (item.hpid ? existingMap.get(item.hpid) : null) || 
                                          existingMap.get(item.dutyName);

                            let hLat = parseFloat(item.wgs84Lat);
                            let hLng = parseFloat(item.wgs84Lon);
                            let finalAddr = hAddr;
                            let finalFid = exist ? exist.id : tempFid;

                            // 1. 이미 DB에 있고 좌표도 정상적이면 지오매핑 스킵
                            if (exist) {
                                hLat = exist.lat;
                                hLng = exist.lng;
                                if (exist.address) finalAddr = exist.address;
                            } 
                            // 2. DB에 없거나 좌표가 불완전한 경우만 지오매핑 실행
                            else if (!hLat || !hLng || hLat <= 33 || hLat >= 39 || hLng <= 124 || hLng >= 132) {
                                const coords = await geocodeAddress(item.dutyName, hAddr);
                                if (coords) {
                                    hLat = coords.lat;
                                    hLng = coords.lng;
                                    if (coords.addr) finalAddr = coords.addr;
                                    await new Promise(r => setTimeout(r, 100)); // 지오매핑 API 딜레이
                                }
                            }

                            if (hLat && hLng) {
                                const sidoName = sido.split(' ')[0];
                                chunk.push({
                                    id: finalFid,
                                    api_source: 'NMC_HOSPITAL',
                                    category: 'HOSPITAL',
                                    name: item.dutyName,
                                    description: '응급실 가동 응급의료기관 (NMC)',
                                    address: finalAddr,
                                    lat: hLat,
                                    lng: hLng,
                                    trust_score: item.dutyName?.includes('소아') ? 100 : 55,
                                    raw_data: { ...item, badges: ['응급의료센터'] },
                                    sido: sidoName,
                                    sigungu: ''
                                });
                            }
                        }
                    }
                    await new Promise(r => setTimeout(r, 200));
                }

                if (chunk.length > 0) {
                    const uniqueRaw = Object.values(chunk.reduce((acc, row) => ({ ...acc, [row.id]: row }), {}));
                    const chunkSize = 50;
                    for (let i = 0; i < uniqueRaw.length; i += chunkSize) {
                        const subChunk = uniqueRaw.slice(i, i + chunkSize);
                        const { error } = await supabase.from('master_places').upsert(subChunk, { onConflict: 'id' });
                        if (!error) totalInserted += subChunk.length;
                    }
                }
            } catch (e: any) {
                console.error('HOSPITAL Sync Error', e.message);
            }
        }

        return NextResponse.json({ success: true, total_inserted: totalInserted });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
