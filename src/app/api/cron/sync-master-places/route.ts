import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';

// Vercel Serverless Function Timeout 설정
export const maxDuration = 300;

// UUID v5 Namespace (Deterministic)
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

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
                        const chunk = itemList.map((item: any) => {
                            const name = item.title;
                            const addr = item.addr1 || item.addr2 || '';
                            return {
                                id: uuidv5(`TOUR_SPOT|${name}|${addr}`, MY_NAMESPACE),
                                api_source: 'TOUR_SPOT', category: 'SPOT',
                                name, description: '한국관광공사 선정 관광명소', address: addr,
                                lat: parseFloat(item.mapy), lng: parseFloat(item.mapx), trust_score: 40, raw_data: item,
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

        return NextResponse.json({ success: true, total_inserted: totalInserted });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
