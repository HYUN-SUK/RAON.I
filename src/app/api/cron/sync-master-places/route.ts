import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Vercel Serverless Function Timeout 설정 (최대 5분이지만, 비동기 배치는 Edge Runtime 혹은 백그라운드 처리 권장)
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

                        // Fake coordinates for mart since this specific API doesn't provide lat/lng in public portal easily.
                        // In reality, Kakao Local API batch reverse-geocoding should be used, but for the hybrid architecture demo, we insert what we can.
                        // Since lat/lng is required in schema, we'll skip those without it, or we rely on Kakao Local dynamically in Route B.
                        // *Note: A real batch system offline resolves coords using Kakao.*
                        pageNo++;
                        await new Promise(r => setTimeout(r, 1000));
                    } else {
                        hasMore = false;
                    }
                } catch (e) { console.error('LARGE_STORE Error', e); hasMore = false; }
            }
        }

        return NextResponse.json({ success: true, total_inserted: totalInserted, status: 'Batch Partially Completed' });
    } catch (error: any) {
        return NextResponse.json({ error: error.message || 'Error' }, { status: 500 });
    }
}
