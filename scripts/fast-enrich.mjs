import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { scrapeKakaoPlaceDetails, closeBrowser } from './utils/scraper.mjs';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;

const CATEGORY_FALLBACKS = {
  RESTAURANT: {
    operating_hours: "정보 없음 (방문 전 확인 권장)",
    closed_days: "연중무휴 또는 정보 없음",
    parking_available: "확인 불가",
    representative_menu: [],
    pet_friendly: "확인 불가 (사전 문의 필수)",
    description: "${name}은(는) 해당 지역에 위치한 식당/카페입니다. 상세 운영 정보는 유선 확인이 필요합니다."
  },
  ROUTE_CAFE: {
    operating_hours: "정보 없음 (방문 전 확인 권장)",
    closed_days: "연중무휴 또는 정보 없음",
    parking_available: "확인 불가",
    representative_menu: [],
    pet_friendly: "확인 불가 (사전 문의 필수)",
    description: "${name}은(는) 해당 지역에 위치한 카페입니다. 상세 운영 정보는 유선 확인이 필요합니다."
  },
  MART: {
    operating_hours: "09:00 - 22:00 (점포별 상이)",
    closed_days: "매월 둘째/넷째 일요일 (지자체별 상이)",
    parking_available: "주차 가능 (일부 소형 마트 제외)",
    description: "${name}은(는) 생필품 및 식자재 구매가 가능한 마트입니다."
  }
};

// 카카오 로컬 검색 API 호출 (place_url 검색용)
async function searchKakao(query, lat, lng) {
  if (!KAKAO_KEY) throw new Error("Missing KAKAO_REST_API_KEY");
  let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  if (lat && lng) {
    url += `&x=${lng}&y=${lat}&radius=10000`;
  }
  const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
  if (res.status === 429) throw new Error("KAKAO_QUOTA_EXCEEDED");
  if (!res.ok) throw new Error(`Kakao API Error (HTTP ${res.status})`);
  const data = await res.json();
  return data.documents || [];
}

// 네이버 로컬 검색 API 호출 (Fallback 용)
async function searchNaver(query) {
  if (!NAVER_ID || !NAVER_SECRET) throw new Error("Missing NAVER Credentials");
  const url = `https://openapi.naver.com/v1/search/local.json?query=${encodeURIComponent(query)}&display=5`;
  const res = await fetch(url, {
    headers: {
      'X-Naver-Client-Id': NAVER_ID,
      'X-Naver-Client-Secret': NAVER_SECRET
    }
  });
  if (res.status === 429) throw new Error("NAVER_QUOTA_EXCEEDED");
  if (!res.ok) throw new Error(`Naver API Error (HTTP ${res.status})`);
  const data = await res.json();
  return data.items || [];
}

// 카카오/네이버 로컬 스위칭 검색
async function searchLocalUnified(name, address, lat, lng) {
  const cleanAddr = address.split(' ').slice(0, 3).join(' ');
  const query = `${cleanAddr} ${name}`;

  try {
    const docs = await searchKakao(query, lat, lng);
    const matched = docs.find(d => d.place_name.replace(/\s/g, '') === name.replace(/\s/g, '')) || docs[0];
    if (matched) {
      return { place_url: matched.place_url, phone: matched.phone };
    }
  } catch (e) {
    console.warn(`[CLI Fast Search Fallback] Kakao failed: ${e.message}. Trying Naver...`);
    try {
      const items = await searchNaver(query);
      const matched = items.find(i => i.title.replace(/<\/?[^>]+(>|$)/g, "").replace(/\s/g, '') === name.replace(/\s/g, '')) || items[0];
      if (matched) {
        const cleanName = matched.title.replace(/<\/?[^>]+(>|$)/g, "");
        return {
          place_url: matched.link || `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanName)}`,
          phone: matched.telephone
        };
      }
    } catch (ne) {
      console.error(`[CLI Fast Search Fallback] Naver failed: ${ne.message}`);
    }
  }
  return null;
}

async function runBatch() {
  console.log(`[CLI Fast Enrichment] Starting Playwright-based Detail Enrichment Job (Quota: Restaurant/Cafe 275, Mart 25).`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Fatal: Missing Supabase Credentials.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const startTime = Date.now();

  let successCount = 0;
  let failCount = 0;
  const processedList = [];

  const targets = [];
  const expirationThreshold = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. 식당/카페 대상 선별 (275건)
    // 1.1 미수집 대상 조회 (raw_data->>operating_hours is null)
    let { data: restUncollected, error: rErr1 } = await supabase
      .from('master_places')
      .select('id, name, address, lat, lng, category, raw_data, description')
      .eq('is_active', true)
      .in('category', ['RESTAURANT', 'ROUTE_CAFE'])
      .is('raw_data->>operating_hours', null)
      .order('updated_at', { ascending: true })
      .limit(275);

    if (rErr1) throw rErr1;
    let restTargets = restUncollected || [];
    console.log(`[Targeting] Found ${restTargets.length} un-enriched Restaurants/Cafes.`);

    // 1.2 모자라면 100일 만료된 대상 조회
    if (restTargets.length < 275) {
      const needed = 275 - restTargets.length;
      let { data: restExpired, error: rErr2 } = await supabase
        .from('master_places')
        .select('id, name, address, lat, lng, category, raw_data, description')
        .eq('is_active', true)
        .in('category', ['RESTAURANT', 'ROUTE_CAFE'])
        .not('raw_data->>operating_hours', 'is', null)
        .lt('updated_at', expirationThreshold)
        .order('updated_at', { ascending: true })
        .limit(needed);

      if (rErr2) throw rErr2;
      restTargets = restTargets.concat(restExpired || []);
      console.log(`[Targeting] Added ${restExpired?.length || 0} expired Restaurants/Cafes. Total: ${restTargets.length}`);
    }
    targets.push(...restTargets);

    // 2. 마트 대상 선별 (25건)
    // 2.1 미수집 대상 조회
    let { data: martUncollected, error: mErr1 } = await supabase
      .from('master_places')
      .select('id, name, address, lat, lng, category, raw_data, description')
      .eq('is_active', true)
      .eq('category', 'MART')
      .is('raw_data->>operating_hours', null)
      .order('updated_at', { ascending: true })
      .limit(25);

    if (mErr1) throw mErr1;
    let martTargets = martUncollected || [];
    console.log(`[Targeting] Found ${martTargets.length} un-enriched Marts.`);

    // 2.2 모자라면 100일 만료된 대상 조회
    if (martTargets.length < 25) {
      const needed = 25 - martTargets.length;
      let { data: martExpired, error: mErr2 } = await supabase
        .from('master_places')
        .select('id, name, address, lat, lng, category, raw_data, description')
        .eq('is_active', true)
        .eq('category', 'MART')
        .not('raw_data->>operating_hours', 'is', null)
        .lt('updated_at', expirationThreshold)
        .order('updated_at', { ascending: true })
        .limit(needed);

      if (mErr2) throw mErr2;
      martTargets = martTargets.concat(martExpired || []);
      console.log(`[Targeting] Added ${martExpired?.length || 0} expired Marts. Total: ${martTargets.length}`);
    }
    targets.push(...martTargets);

    console.log(`Total enrichment targets selected: ${targets.length} places.`);

    if (targets.length === 0) {
      console.log("No targets found for enrichment today. Exiting.");
      process.exit(0);
    }

    // Playwright를 이용한 병렬 크롤링 (동시 실행 수를 2로 낮춤)
    const concurrency = 2;
    for (let i = 0; i < targets.length; i += concurrency) {
      const chunk = targets.slice(i, i + concurrency);
      
      await Promise.all(chunk.map(async (place) => {
        const name = place.name;
        const address = place.address || '';
        const category = place.category === 'ROUTE_CAFE' ? 'ROUTE_CAFE' : place.category === 'MART' ? 'MART' : 'RESTAURANT';
        const defaultFallback = { ...CATEGORY_FALLBACKS[category] };
        
        try {
          let placeUrl = place.raw_data?.place_url || place.raw_data?.placeUrl || place.raw_data?.kakao_url;

          // 1. place_url이 없으면 검색
          if (!placeUrl) {
            const searchResult = await searchLocalUnified(name, address, place.lat, place.lng);
            if (searchResult) {
              placeUrl = searchResult.place_url;
            }
          }

          let details = null;
          let kakaoId = '';
          if (placeUrl && placeUrl.includes('place.map.kakao.com/')) {
            const parts = placeUrl.split('/');
            kakaoId = parts[parts.length - 1];
          }

          // 2. Playwright 크롤링 실행
          if (kakaoId) {
            details = await scrapeKakaoPlaceDetails(kakaoId);
          }

          // 3. Fallback 적용 및 데이터 병합
          const operating_hours = details?.operating_hours || defaultFallback.operating_hours;
          const closed_days = details?.closed_days || defaultFallback.closed_days;
          const parking_available = details?.parking_available || defaultFallback.parking_available;
          const representative_menu = details?.representative_menu || defaultFallback.representative_menu;
          const pet_friendly = details?.pet_friendly || defaultFallback.pet_friendly;
          const homepage_url = details?.homepage_url || place.raw_data?.homepage_url || '';

          const updatedRaw = {
            ...(place.raw_data || {}),
            enriched: true,
            place_url: placeUrl || place.raw_data?.place_url,
            operating_hours,
            closed_days,
            parking_available,
            representative_menu,
            pet_friendly,
            homepage_url
          };

          // 4. DB 갱신
          const { error: updateErr } = await supabase
            .from('master_places')
            .update({
              raw_data: updatedRaw,
              description: place.description || defaultFallback.description.replace('${name}', name),
              updated_at: new Date().toISOString()
            })
            .eq('id', place.id);

          if (updateErr) {
            console.error(`  -> Failed to update ${name}: ${updateErr.message}`);
            failCount++;
          } else {
            console.log(`  -> Successfully enriched: ${name} [${category}]`);
            successCount++;
            processedList.push(`${name} (${category})`);
          }

        } catch (err) {
          console.error(`  -> Error processing ${name}: ${err.message}`);
          failCount++;
        }
      }));

      // IP 차단을 피하기 위한 랜덤 딜레이 (2.0초 ~ 4.0초)
      const delay = 2000 + Math.random() * 2000;
      await new Promise(r => setTimeout(r, delay));
    }

    const duration = Date.now() - startTime;
    console.log(`\n=== Playwright enrichment completed ===`);
    console.log(`Success: ${successCount} items`);
    console.log(`Failed: ${failCount} items`);
    console.log(`Total duration: ${(duration / 1000).toFixed(2)} seconds`);

    // automation_logs에 수행 결과 기록
    await supabase.from('automation_logs').insert({
      job_name: 'DAILY_MASTER_ENRICHMENT',
      status: successCount > 0 ? 'SUCCESS' : 'FAILURE',
      processed_count: successCount,
      message: `Playwright 상세정보 쿼터제 수집 완료: 식당/카페 및 마트 성공 ${successCount}건, 실패 ${failCount}건.`,
      duration_ms: duration,
      api_status: {
        attempted: successCount + failCount,
        success: successCount,
        failed: failCount,
        processed: processedList
      },
      created_at: new Date().toISOString()
    });

  } catch (error) {
    console.error(`Fatal Bulk Error:`, error.message);
    await closeBrowser();
    process.exit(1);
  } finally {
    await closeBrowser();
  }
}

runBatch();
