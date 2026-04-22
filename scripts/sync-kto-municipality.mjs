/**
 * 한국관광공사 기초지자체 중심 관광지 정보(티맵 기반 순위) 전수 수집 엔진
 * [v12.0] 2026-01-12 변경 규격 (lDongRegnCd, lDongSignguCd) 반영
 */
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { ADMIN_SIDO_MAP, SIGUNGU_CODE_MASTER } from './utils/admin-code-mapping.mjs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const API_KEY = process.env.PUBLIC_DATA_API_KEY;

const delay = (ms) => new Promise(res => setTimeout(res, ms));

async function fetchWithRetry(url, maxRetries = 3) {
  for (let i = 0; i < maxRetries; i++) {
    try {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      if (text.includes('Unexpected errors')) throw new Error('API Server Error (Unexpected errors)');
      return JSON.parse(text);
    } catch (e) {
      if (i === maxRetries - 1) throw e;
      await delay(Math.pow(2, i) * 1000);
    }
  }
}

async function syncKtoPopularity() {
  console.log('🚀 Starting KTO Official Municipality Popularity Full Sync...');
  
  const now = new Date();
  const baseYm = '202403'; // Baseline (Can be dynamic)
  
  const sigungus = Object.entries(SIGUNGU_CODE_MASTER);
  console.log(`- Total Sigungus to process: ${sigungus.length}`);

  for (const [name, signguCd] of sigungus) {
    const areaCd = signguCd.substring(0, 2);
    console.log(`\n- [${name}] Processing (${signguCd})...`);

    const url = `http://apis.data.go.kr/B551011/TarService/getAreaBasedSyncList?serviceKey=${API_KEY}&numOfRows=100&pageNo=1&MobileOS=ETC&MobileApp=RAONAI&_type=json&baseYm=${baseYm}&lDongRegnCd=${areaCd}&lDongSignguCd=${signguCd}`;

    try {
      const data = await fetchWithRetry(url);
      const items = data?.response?.body?.items?.item;
      const list = Array.isArray(items) ? items : (items ? [items] : []);

      if (list.length === 0) {
        console.warn(`  ⚠️ No data returned for ${name}`);
        continue;
      }

      console.log(`  ✅ Received ${list.length} ranking items.`);

      // Update master_places for matches
      let matchCount = 0;
      for (const item of list) {
        // Simple name matching (Cleanup logic can be added)
        const { data: spots } = await supabase
          .from('master_places')
          .select('id, raw_data')
          .ilike('name', `%${item.itsBroNm}%`)
          .eq('sigungu', name.replace(/\(.+?\)/g, ''));

        if (spots && spots.length > 0) {
          for (const spot of spots) {
            const newRaw = { 
              ...spot.raw_data, 
              kto_official: {
                rank: parseInt(item.rank),
                search_cnt: parseInt(item.searchCnt || 0),
                base_ym: item.baseYm,
                updated_at: new Date().toISOString()
              }
            };
            await supabase.from('master_places').update({ raw_data: newRaw }).eq('id', spot.id);
            matchCount++;
          }
        }
      }
      console.log(`  ✨ Matched and updated ${matchCount} spots in DB.`);
      
      // Too many calls might cause 429
      await delay(500);

    } catch (e) {
      console.error(`  ❌ Error processing ${name}:`, e.message);
    }
  }

  console.log('\n✅ KTO Official Popularity Full Sync Completed.');
}

syncKtoPopularity().catch(console.error);
