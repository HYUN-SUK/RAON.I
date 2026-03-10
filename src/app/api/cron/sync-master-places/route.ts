import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function Timeout 설정 (최대 5분이지만, 비동기 배치는 Edge Runtime 혹은 백그라운드 처리 권장)
export const maxDuration = 300;

// 카카오 지오코딩 헬퍼: 주소 → 위경도 변환
async function geocodeAddress(address: string): Promise<{ lat: number; lng: number } | null> {
    const kakaoKey = process.env.KAKAO_REST_API_KEY;
    if (!kakaoKey || !address) return null;
    try {
        const res = await fetch(
            `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`,
            { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } }
        );
        const data = await res.json();
        if (data.documents && data.documents.length > 0) {
            return {
                lat: parseFloat(data.documents[0].y),
                lng: parseFloat(data.documents[0].x)
            };
        }
        // 주소 검색 실패 시 키워드 검색으로 폴백
        const kwRes = await fetch(
            `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(address)}`,
            { headers: { 'Authorization': `KakaoAK ${kakaoKey}` } }
        );
        const kwData = await kwRes.json();
        if (kwData.documents && kwData.documents.length > 0) {
            return {
                lat: parseFloat(kwData.documents[0].y),
                lng: parseFloat(kwData.documents[0].x)
            };
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

        // ==========================================
        // 1. 관광 명소 (TOUR_SPOT) - 한국관광공사
        // ==========================================
        if (targetCategory === 'ALL' || targetCategory === 'SPOT') {
            console.log(`[Master Sync Cron] Fetching TOUR_SPOT...`);
            let pageNo = 1;
            let hasMore = true;
            while (hasMore && pageNo <= 50) { // Limit to 50 pages (5,000 items) per run to avoid timeout
                try {
                    const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${publicApiKey}&numOfRows=100&pageNo=${pageNo}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12`, fetchOptions);
                    const data = await res.json();
                    if (data.response?.body?.items?.item) {
                        const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                        if (items.length === 0) { hasMore = false; break; }

                        const chunk = items.map((item: any) => ({
                            id: crypto.randomUUID(), api_source: 'TOUR_SPOT', category: 'SPOT',
                            name: item.title, description: '한국관광공사 선정 관광명소', address: item.addr1 || item.addr2 || '',
                            lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 40, raw_data: item,
                            sido: '', sigungu: '' // We can reverse geocode or map area codes later
                        })).filter((i: any) => !isNaN(i.lat) && !isNaN(i.lng));

                        if (chunk.length > 0) {
                            const { error } = await supabase.from('master_places').insert(chunk);
                            if (error) console.error('[Master Sync] Insert Error:', error.message);
                            else totalInserted += chunk.length;
                        }

                        pageNo++;
                        await new Promise(r => setTimeout(r, 1000)); // 1s Throttle
                    } else {
                        hasMore = false;
                    }
                } catch (e) { console.error('TOUR_SPOT Error', e); hasMore = false; }
            }
        }

        // ==========================================
        // 2. 대형마트 (LARGE_STORE) - 행정안전부
        // ==========================================
        if (targetCategory === 'ALL' || targetCategory === 'MART') {
            console.log(`[Master Sync Cron] Fetching LARGE_STORE...`);
            let pageNo = 1;
            let hasMore = true;
            while (hasMore && pageNo <= 30) {
                try {
                    const res = await fetch(`https://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${publicApiKey}&pageNo=${pageNo}&numOfRows=100&returnType=json`, fetchOptions);
                    const data = await res.json();
                    if (data.response?.body?.items?.item) {
                        const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                        if (items.length === 0) { hasMore = false; break; }

                        // 카카오 지오코딩으로 주소 → 좌표 변환 후 삽입
                        const chunk = [];
                        for (const item of items) {
                            const addr = item.RDNWHL_ADDR || item.LNM_ADDR || item.BPLC_NM || '';
                            if (!addr) continue;
                            const coords = await geocodeAddress(addr);
                            if (!coords) continue; // 좌표 변환 실패 시 스킵 (더미값 삽입 방지)
                            chunk.push({
                                id: crypto.randomUUID(), api_source: 'LARGE_STORE', category: 'MART',
                                name: item.BPLC_NM || item.STRNM || addr, description: '행정안전부 등록 대규모 점포',
                                address: addr, lat: coords.lat, lng: coords.lng,
                                trust_score: 60, raw_data: item,
                                sido: item.CTPRVN_NM || '', sigungu: item.SIGNGU_NM || ''
                            });
                            await new Promise(r => setTimeout(r, 100)); // 카카오 API 과부하 방지
                        }
                        if (chunk.length > 0) {
                            const { error } = await supabase.from('master_places').insert(chunk);
                            if (error) console.error('[Master Sync] MART Insert Error:', error.message);
                            else totalInserted += chunk.length;
                        }
                        pageNo++;
                        await new Promise(r => setTimeout(r, 1000));
                    } else {
                        hasMore = false;
                    }
                } catch (e) { console.error('LARGE_STORE Error', e); hasMore = false; }
            }
        }

        // ==========================================
        // 3-1. 식당 (소상공인시장진흥공단 백년가게)
        // ==========================================
        if (targetCategory === 'ALL' || targetCategory === 'RESTAURANT') {
            console.log(`[Master Sync Cron] Fetching SMBA_BAEK...`);
            let pageNo = 1;
            let hasMore = true;
            try {
                const specUrl = `https://infuser.odcloud.kr/oas/docs?namespace=${encodeURIComponent('15102255/v1')}`;
                const specRes = await fetch(specUrl, fetchOptions);
                const spec = await specRes.json();
                const paths = Object.keys(spec.paths || {});
                if (paths.length > 0) {
                    const latestPath = paths[0];
                    while (hasMore && pageNo <= 30) {
                        try {
                            const res = await fetch(`https://api.odcloud.kr/api${latestPath}?serviceKey=${publicApiKey}&page=${pageNo}&perPage=100`, fetchOptions);
                            const data = await res.json();
                            if (data.data && Array.isArray(data.data) && data.data.length > 0) {
                                const chunk = [];
                                for (const item of data.data) {
                                    const addr = item['주소'] || '';
                                    if (!addr || !item['업체명']) continue;
                                    const coords = await geocodeAddress(addr);
                                    if (!coords) continue; // 좌표 변환 실패 시 스킵
                                    chunk.push({
                                        id: crypto.randomUUID(), api_source: 'SMBA_BAEK', category: 'RESTAURANT',
                                        name: item['업체명'], description: `백년가게 공식 지정 (${item['업종'] || '식당'})`, address: addr,
                                        lat: coords.lat, lng: coords.lng, trust_score: 80, raw_data: item,
                                        sido: item['시도·시군구']?.split(' ')[0] || '', sigungu: item['시도·시군구']?.split(' ')[1] || ''
                                    });
                                    await new Promise(r => setTimeout(r, 100)); // 카카오 API 과부하 방지
                                }
                                const { error } = await supabase.from('master_places').insert(chunk);
                                if (!error) totalInserted += chunk.length;
                                pageNo++;
                                await new Promise(r => setTimeout(r, 1000));
                            } else {
                                hasMore = false;
                            }
                        } catch (e) { hasMore = false; }
                    }
                }
            } catch (e) { console.error('SMBA_BAEK Setup Error', e); }
        }

        // ==========================================
        // 3-2. 식당 (농식품부 안심식당)
        // ==========================================
        if (targetCategory === 'ALL' || targetCategory === 'RESTAURANT') {
            console.log(`[Master Sync Cron] Fetching SAFE_RESTAURANT...`);
            let pageNo = 1;
            let hasMore = true;
            const safeKey = process.env.SAFE_RESTAURANT_API_KEY;
            if (safeKey) {
                while (hasMore && pageNo <= 30) {
                    try {
                        const start = (pageNo - 1) * 1000 + 1;
                        const end = pageNo * 1000;
                        const res = await fetch(`http://211.237.50.150:7080/openapi/${safeKey}/json/Grid_20200713000000000605_1/${start}/${end}`, fetchOptions);
                        const data = await res.json();
                        if (data.Grid_20200713000000000605_1?.row && data.Grid_20200713000000000605_1.row.length > 0) {
                            const items = data.Grid_20200713000000000605_1.row;
                            const chunk = [];
                            for (const item of items) {
                                const addr = item.RELAX_ADD1 || '';
                                if (!addr || !item.RELAX_REST_NM) continue;
                                const coords = await geocodeAddress(addr);
                                if (!coords) continue; // 좌표 변환 실패 시 스킵
                                chunk.push({
                                    id: crypto.randomUUID(), api_source: 'SAFE_RESTAURANT', category: 'RESTAURANT',
                                    name: item.RELAX_REST_NM, description: '농식품부 인증 위생 안심식당', address: addr,
                                    lat: coords.lat, lng: coords.lng, trust_score: 50, raw_data: item,
                                    sido: item.RELAX_SI_NM || '', sigungu: item.RELAX_SIDO_NM || ''
                                });
                                await new Promise(r => setTimeout(r, 100));
                            }
                            const { error } = await supabase.from('master_places').insert(chunk);
                            if (!error) totalInserted += chunk.length;
                            pageNo++;
                            await new Promise(r => setTimeout(r, 500));
                        } else {
                            hasMore = false;
                        }
                    } catch (e) { hasMore = false; }
                }
            }
        }

        // ==========================================
        // 3-3. 식당 (행정안전부 모범음식점정보 조회서비스)
        // ==========================================
        if (targetCategory === 'ALL' || targetCategory === 'RESTAURANT') {
            console.log(`[Master Sync Cron] Fetching MOIS_GOOD_RESTAURANT...`);
            let pageNo = 1;
            let hasMore = true;
            while (hasMore && pageNo <= 30) {
                try {
                    // Typical MOIS Good Restaurant open API format from data.go.kr
                    const res = await fetch(`http://apis.data.go.kr/1741000/excellent_restaurant_info/info?serviceKey=${publicApiKey}&pageNo=${pageNo}&numOfRows=100&returnType=json`, fetchOptions);
                    const data = await res.json();
                    if (data.response?.body?.items?.item) {
                        const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                        if (items.length === 0) { hasMore = false; break; }

                        const chunk = [];
                        for (const item of items) {
                            const name = item.BPLC_NM || item.bplcNm || item.name || '';
                            const addr = item.RDNWH_ADDR || item.SITE_WHL_ADDR || item.address || '';
                            if (!addr || !name) continue;
                            const coords = await geocodeAddress(addr);
                            if (!coords) continue; // 좌표 변환 실패 시 스킵
                            chunk.push({
                                id: crypto.randomUUID(), api_source: 'MOIS_GOOD_RESTAURANT', category: 'RESTAURANT',
                                name, description: '행정안전부 지정 모범음식점', address: addr,
                                lat: coords.lat, lng: coords.lng, trust_score: 55, raw_data: item,
                                sido: item.SIDO_NM || '', sigungu: item.SIGUNGU_NM || ''
                            });
                            await new Promise(r => setTimeout(r, 100));
                        }
                        const { error } = await supabase.from('master_places').insert(chunk);
                        if (!error) totalInserted += chunk.length;
                        pageNo++;
                        await new Promise(r => setTimeout(r, 500));
                    } else {
                        hasMore = false;
                    }
                } catch (e) { hasMore = false; }
            }
        }

        // ==========================================
        // 4. 주유소 (OPINET)
        // ==========================================
        if (targetCategory === 'ALL' || targetCategory === 'GAS_STATION') {
            console.log(`[Master Sync Cron] Fetching OPINET...`);
            // Opinet provides a specific route. For nationwide, we usually sweep by local codes.
            // This is a placeholder for the logic (using a single radius fetch as before for demo)
            try {
                if (process.env.OPINET_API_KEY) {
                    const opinetRes = await fetch(`http://www.opinet.co.kr/api/aroundAll.do?code=${process.env.OPINET_API_KEY}&x=175658&y=341695&radius=10000&sort=1&prodcd=C004&out=json`, fetchOptions);
                    const opinetData = await opinetRes.json();
                    if (opinetData.RESULT?.OIL) {
                        const items = Array.isArray(opinetData.RESULT.OIL) ? opinetData.RESULT.OIL : [opinetData.RESULT.OIL];
                        const chunk = [];
                        for (const item of items) {
                            const addr = item.NEW_ADR || item.VAN_ADR || '';
                            const name = item.OS_NM || '';
                            if (!name) continue;
                            // OPINET은 KATECH 좌표(x/y)를 쓰므로 주소 기반 카카오 지오코딩으로 WGS84 변환
                            const coords = addr ? await geocodeAddress(addr) : null;
                            if (!coords) continue; // 좌표 변환 실패 시 스킵
                            chunk.push({
                                id: crypto.randomUUID(), api_source: 'OPINET', category: 'GAS_STATION',
                                name, description: '겨울철 난방 실내등유(팬히터용) 주유소', address: addr,
                                lat: coords.lat, lng: coords.lng, trust_score: 95, raw_data: item,
                                sido: '', sigungu: ''
                            });
                            await new Promise(r => setTimeout(r, 100));
                        }
                        await supabase.from('master_places_gas').insert(chunk);
                        totalInserted += chunk.length;
                    }
                }
            } catch (e) { console.error('OPINET Error', e); }
        }

        // ==========================================
        // 3-4. 카페 (TOUR_CAFE) - 한국관광공사 기반 필터링
        // ==========================================
        if (targetCategory === 'ALL' || targetCategory === 'RESTAURANT') {
            console.log(`[Master Sync Cron] Fetching TOUR_CAFE...`);
            let pageNo = 1;
            let hasMore = true;
            while (hasMore && pageNo <= 10) {
                try {
                    const res = await fetch(`http://apis.data.go.kr/B551011/KorService2/areaBasedList2?serviceKey=${publicApiKey}&numOfRows=100&pageNo=${pageNo}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=39`, fetchOptions);
                    const data = await res.json();
                    if (data.response?.body?.items?.item) {
                        const items = Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item];
                        const chunk = items
                            .filter((item: any) => item.title.includes('카페') || item.title.includes('커피'))
                            .map((item: any) => ({
                                id: crypto.randomUUID(), api_source: 'TOUR_CAFE', category: 'RESTAURANT',
                                name: item.title, description: '한국관광공사 등록 카페/전통찻집', address: item.addr1 || '',
                                lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 45, raw_data: item,
                                sido: '', sigungu: ''
                            })).filter((i: any) => !isNaN(i.lat) && !isNaN(i.lng));

                        if (chunk.length > 0) {
                            await supabase.from('master_places').insert(chunk);
                            totalInserted += chunk.length;
                        }
                        pageNo++;
                        await new Promise(r => setTimeout(r, 500));
                    } else { hasMore = false; }
                } catch (e) { hasMore = false; }
            }
        }

        return NextResponse.json({ success: true, total_inserted: totalInserted, status: 'Batch Partially Completed' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
