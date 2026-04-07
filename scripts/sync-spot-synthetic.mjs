import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const TOUR_API_KEY = process.env.TOUR_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const BASE_URL = 'https://apis.data.go.kr/B551011/KorService1';

/**
 * 전국 명소 인기도 지형도 완성 (Ground Zero)
 * 1. arrange=B 옵션으로 전국 국문 관광정보를 조회하여 인기도 순위에 따른 가산점을 부여합니다.
 * 2. 12,000여 건의 데이터를 약 250회 API 호출로 처리합니다.
 */
async function syncSpotSynthetic() {
  console.log('🚀 [Ground Zero] 전국 명소 가상 인기도 적재 시작...');
  
  const MAX_TOTAL = 13000; 
  const PAGE_SIZE = 50;
  const TOTAL_PAGES = Math.ceil(MAX_TOTAL / PAGE_SIZE);
  
  const MAX_SCORE = 100000;
  const MIN_SCORE = 10;
  const DECAY_RATE = (MAX_SCORE - MIN_SCORE) / MAX_TOTAL;

  let globalRank = 1;
  let updatedCount = 0;

  for (let page = 1; page <= TOTAL_PAGES; page++) {
    console.log(`\n📦 Fetching Page ${page}/${TOTAL_PAGES} (Rank ${globalRank}~)...`);
    
    const params = new URLSearchParams({
      serviceKey: TOUR_API_KEY,
      numOfRows: PAGE_SIZE.toString(),
      pageNo: page.toString(),
      MobileOS: 'ETC',
      MobileApp: 'RAONAI',
      _type: 'json',
      listYN: 'Y',
      arrange: 'B' // 인기도순 정렬 (핵심)
    });

    try {
      const response = await fetch(`${BASE_URL}/areaBasedList1?${params.toString()}`);
      if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
      
      const data = await response.json();
      const items = data.response?.body?.items?.item || [];

      if (items.length === 0) {
          console.log('🏁 No more items found. Finishing...');
          break;
      }

      for (const item of items) {
        const contentId = item.contentid;
        const syntheticScore = Math.floor(MAX_SCORE - (globalRank * DECAY_RATE));
        
        // DB 업데이트: contentid 기준 매칭
        // Note: raw_data 내의 contentid와 매칭하거나, UUID v5 생성 규칙을 알고 있다면 직접 ID로 업데이트 가능.
        // 여기서는 안전하게 rpc를 사용하거나 filter로 업데이트.
        
        const { data: updateData, error: updateError } = await supabase
          .from('master_places')
          .update({
            // raw_data를 보존하면서 인기도 필드 및 가상 플래그 추가
            raw_data: { 
              ...item, 
              readcount: syntheticScore.toString(),
              readcount_synthetic: true,
              readcount_updated_at: new Date().toISOString()
            }
          })
          .eq('category', 'SPOT')
          .filter('raw_data->>contentid', 'eq', contentId);

        if (updateError) {
          console.error(`  ❌ Failed to update contentid ${contentId}:`, updateError.message);
        } else {
          updatedCount++;
          if (updatedCount % 100 === 0) {
            process.stdout.write(`\r  ✅ Updated ${updatedCount} items...`);
          }
        }
        
        globalRank++;
      }
    } catch (err) {
      console.error(`  ⚠️ Page ${page} failed:`, err.message);
      continue;
    }
  }

  console.log(`\n\n✨ [Ground Zero] 완료! 총 ${updatedCount}개 명소의 인기도 지형도가 완성되었습니다.`);
}

syncSpotSynthetic();
