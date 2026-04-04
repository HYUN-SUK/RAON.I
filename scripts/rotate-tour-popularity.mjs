/**
 * @file rotate-tour-popularity.mjs
 * @version 1.0.0
 * @description 관광명소(SPOT) 인기도(readcount) 일일 800건 순환 업데이트 엔진
 * [v11.9.4] 쿼터 보호(1000회 제한)를 위해 매일 800건씩만 순환 갱신합니다.
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import http from 'http';
import https from 'https';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

// API 호출 재시도 헬퍼
async function fetchWithRetry(url, options = {}, retries = 3) {
    for (let i = 0; i < retries; i++) {
        try {
            const agent = url.startsWith('https') ? httpsAgent : httpAgent;
            const res = await fetch(url, { ...options, agent });
            if (res.ok) return res;
            if (res.status === 429) { await new Promise(r => setTimeout(r, 2000)); continue; }
            throw new Error(`HTTP ${res.status}`);
        } catch (e) {
            if (i === retries - 1) throw e;
            const wait = Math.pow(2, i) * 1000;
            console.warn(`    [Retry] Fetch failed: ${e.message}. Retrying in ${wait}ms... (${i+1}/${retries})`);
            await new Promise(r => setTimeout(r, wait));
        }
    }
}

async function main() {
    console.log('🚀 [Rolling-800] 관광명소 인기도 순환 수집 엔진 가동...');

    // 1. 갱신이 필요한 800건 추출 (readcount_updated_at이 없거나 오래된 순)
    // SQL: ORDER BY (raw_data->>'readcount_updated_at') ASC NULLS FIRST
    // 수동 정렬을 위해 fetch 후 클라이언트 사이드 처리가 필요하지만, 
    // Supabase 쿼리에서 JSON 필드 정렬을 시도합니다.
    const { data: targets, error: fetchError } = await supabase
        .from('master_places')
        .select('id, name, raw_data')
        .eq('api_source', 'TOUR_SPOT')
        .order('id') // 기본 정렬
        .limit(2000); // 넉넉히 가져와서 클라이언트에서 필터링

    if (fetchError || !targets) {
        console.error('❌ 대상 목록 추출 실패:', fetchError?.message);
        return;
    }

    // 갱신일 기준 정렬 (raw_data 내 기록된 시간 기준)
    const sortedTargets = targets.sort((a, b) => {
        const tA = a.raw_data?.readcount_updated_at || '1970-01-01';
        const tB = b.raw_data?.readcount_updated_at || '1970-01-01';
        return tA.localeCompare(tB);
    }).slice(0, 800); // 일일 800건 초과 금지

    console.log(`🎯 이번 턴 업데이트 대상: ${sortedTargets.length}건 선별 완료.`);

    let updatedCount = 0;
    const batch = [];

    for (const target of sortedTargets) {
        const contentId = target.raw_data?.contentid;
        if (!contentId) continue;

        try {
            const url = `http://apis.data.go.kr/B551011/KorService2/detailCommon2?serviceKey=${PUBLIC_API_KEY}&MobileOS=ETC&MobileApp=AppTest&_type=json&contentId=${contentId}&defaultYN=Y&firstImageYN=Y&areacodeYN=Y&catcodeYN=Y&addrinfoYN=Y&mapinfoYN=Y&overviewYN=Y`;
            const res = await fetchWithRetry(url);
            const data = await res.json();
            const info = data.response?.body?.items?.item?.[0];

            if (info) {
                const readcount = parseInt(info.readcount || '0', 10);
                const newRawData = {
                    ...target.raw_data,
                    readcount: readcount,
                    readcount_updated_at: new Date().toISOString()
                };

                batch.push({
                    id: target.id,
                    raw_data: newRawData
                });

                updatedCount++;
                if (updatedCount % 50 === 0) process.stdout.write(`.` );
            }
        } catch (e) {
            console.error(`\n❌ [${target.name}] 수집 실패:`, e.message);
        }

        // 지연 (API 부하 방지 및 Throttling: 초당 약 10건)
        await new Promise(r => setTimeout(r, 100));

        // 100건 단위로 DB 저장
        if (batch.length >= 100) {
            const chunk = batch.splice(0, 100);
            await supabase.from('master_places').upsert(chunk, { onConflict: 'id' });
        }
    }

    // 나머지 저장
    if (batch.length > 0) {
        await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
    }

    console.log(`\n🏁 Done. 총 ${updatedCount}건의 인기도 정보를 갱신했습니다.`);
}

main();
