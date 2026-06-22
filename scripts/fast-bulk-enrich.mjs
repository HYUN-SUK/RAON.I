import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const NAVER_ID = process.env.NAVER_CLIENT_ID;
const NAVER_SECRET = process.env.NAVER_CLIENT_SECRET;

// v10 규격 표준 폴백 상수 정의
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
    console.warn(`[Fast Bulk Search Fallback] Kakao failed: ${e.message}. Trying Naver...`);
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
      console.error(`[Fast Bulk Search Fallback] Naver failed: ${ne.message}`);
    }
  }
  return null;
}

// Playwright 리소스 네트워크 차단 및 이벤트 기반 대기 고속 수집 함수
async function scrapeKakaoPlaceDetailsFast(activeBrowser, placeId) {
  const url = `https://place.map.kakao.com/m/${placeId}`;
  let context = null;
  let page = null;
  
  try {
    context = await activeBrowser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812 },
      isMobile: true
    });
    
    page = await context.newPage();
    


    // 2. 페이지 이동 (기본 타임아웃 10초)
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    // 3. 이벤트 기반 대기 (필수 셀렉터 렌더 즉시 대기 종료)
    try {
      await page.waitForSelector('.txt_operation, .list_menu, .fold_detail', { timeout: 2500 });
    } catch (e) {
      // 대기 초과시 300ms만 더 쉬고 수집 강행
      await page.waitForTimeout(300);
    }
    
    const details = await page.evaluate(() => {
      let operating_hours = '';
      let closed_days = '';
      let parking_available = '확인 불가';
      let pet_friendly = '확인 불가';
      let homepage_url = '';
      const representative_menu = [];
      
      // 1. 영업시간 & 휴무일 파싱
      const foldDetail = document.querySelector('.fold_detail');
      if (foldDetail) {
        operating_hours = foldDetail.innerText.replace(/\n/g, ', ').trim();
        const matches = foldDetail.innerText.match(/([월화수목금토일]\([^)]+\))휴무일/);
        if (matches) {
          closed_days = matches[1].trim() + ' 휴무';
        }
      } else {
        const txtOp = document.querySelector('.txt_operation');
        if (txtOp) {
          operating_hours = txtOp.innerText.trim();
        }
      }
      
      // 2. 주차 & 애견동반 파싱
      const addInfos = document.querySelectorAll('.unit_default, .unit_infoetc, .wrap_storeetc div');
      addInfos.forEach(unit => {
        const titEl = unit.querySelector('.tit_addinfo');
        const infoEl = unit.querySelector('.detail_info, .txt_detail');
        if (titEl && infoEl) {
          const title = titEl.innerText.trim();
          const value = infoEl.innerText.trim();
          if (title.includes('주차')) {
            parking_available = value;
          } else if (title.includes('반려동물') || title.includes('애견')) {
            pet_friendly = value;
          }
        }
      });
      
      // 3. 홈페이지 URL 파싱
      const linkHomepage = document.querySelector('a.link_homepage, a.link_website, .link_homepage');
      if (linkHomepage) {
        homepage_url = linkHomepage.getAttribute('href') || linkHomepage.innerText.trim() || '';
      }
      
      // 4. 대표 메뉴 파싱
      const menuElements = document.querySelectorAll('.list_goods li, .list_menu li, .menu_board li, .menu_list li');
      menuElements.forEach(el => {
        const nameEl = el.querySelector('.tit_item, .txt_menu, .tit_menu, .name_menu');
        const priceEl = el.querySelector('.desc_item, .txt_price, .price_menu');
        if (nameEl) {
          const name = nameEl.innerText.trim();
          let price = priceEl ? priceEl.innerText.trim() : '';
          price = price.replace(/\s+/g, ' ');
          representative_menu.push(`${name}${price ? ' (' + price + ')' : ''}`);
        }
      });
      
      return {
        operating_hours: operating_hours || undefined,
        closed_days: closed_days || undefined,
        parking_available: parking_available !== '확인 불가' ? parking_available : undefined,
        pet_friendly: pet_friendly !== '확인 불가' ? pet_friendly : undefined,
        representative_menu: representative_menu.length > 0 ? representative_menu.slice(0, 5) : undefined,
        homepage_url: homepage_url || undefined
      };
    });
    
    return details;
  } catch (err) {
    console.error(`[Playwright Fast Error] placeId: ${placeId}, msg: ${err.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

async function runBulkEnrich() {
  let sessionStartTime = new Date().toISOString(); // 스크립트 실행 시점 고정
  const sessionTimeArgIdx = process.argv.findIndex(arg => arg === '--session-start-time');
  if (sessionTimeArgIdx !== -1 && process.argv[sessionTimeArgIdx + 1]) {
    sessionStartTime = process.argv[sessionTimeArgIdx + 1];
  }

  let lastId = null;
  const lastIdArgIdx = process.argv.findIndex(arg => arg === '--last-id');
  if (lastIdArgIdx !== -1 && process.argv[lastIdArgIdx + 1]) {
    lastId = process.argv[lastIdArgIdx + 1];
  }

  let limit = 1000;
  const limitArgIdx = process.argv.findIndex(arg => arg === '--limit');
  if (limitArgIdx !== -1 && process.argv[limitArgIdx + 1]) {
    limit = parseInt(process.argv[limitArgIdx + 1], 10);
  }

  let concurrency = 8;
  const concurrencyArgIdx = process.argv.findIndex(arg => arg === '--concurrency');
  if (concurrencyArgIdx !== -1 && process.argv[concurrencyArgIdx + 1]) {
    concurrency = parseInt(process.argv[concurrencyArgIdx + 1], 10);
  }

  console.log(`[CLI Fast Bulk Enrichment] Launching. Target Limit: ${limit}, Concurrency: ${concurrency}`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Fatal: Missing Supabase credentials.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const startTime = Date.now();

  let successCount = 0;
  let failCount = 0;
  
  // 카테고리별 실시간 적재 실패/차단 자동 모니터링 변수
  const consecutiveFailuresByCategory = {
    RESTAURANT: 0,
    ROUTE_CAFE: 0,
    MART: 0
  };
  const maxConsecutiveFailures = 10; // 특정 카테고리가 연속 10회 실패 시 중단

  function checkRealEnriched(category, details) {
    if (!details) return false;
    const fb = CATEGORY_FALLBACKS[category];
    if (!fb) return false;

    if (category === 'RESTAURANT' || category === 'ROUTE_CAFE') {
      const hasRealHours = details.operating_hours && details.operating_hours !== fb.operating_hours;
      const hasRealMenu = Array.isArray(details.representative_menu) && details.representative_menu.length > 0;
      const hasRealHomepage = details.homepage_url && details.homepage_url !== undefined && details.homepage_url !== '';
      return !!(hasRealHours || hasRealMenu || hasRealHomepage);
    }
    if (category === 'MART') {
      const hasRealHours = details.operating_hours && details.operating_hours !== fb.operating_hours;
      const hasRealParking = details.parking_available && details.parking_available !== fb.parking_available;
      return !!(hasRealHours || hasRealParking);
    }
    return false;
  }

  function getAbortedCategory() {
    return Object.keys(consecutiveFailuresByCategory).find(
      cat => consecutiveFailuresByCategory[cat] >= maxConsecutiveFailures
    );
  }

  const processedList = [];
  const buffer = [];

  // Playwright 브라우저 기동
  const browser = await chromium.launch({
    headless: true,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--disable-dev-shm-usage',
      '--disable-accelerated-2d-canvas',
      '--disable-gpu'
    ]
  });

  try {
    console.log("Querying target places for bulk enrichment (Cursor-based ID scan)...");
    let selectQuery = supabase
      .from('master_places')
      .select('id, name, address, lat, lng, category, raw_data, description, api_source')
      .eq('is_active', true)
      .in('category', ['RESTAURANT', 'ROUTE_CAFE', 'MART'])
      .order('id');

    if (lastId) {
      selectQuery = selectQuery.gt('id', lastId);
    }

    const { data: rawPlaces, error: fetchErr } = await selectQuery.limit(limit);

    if (fetchErr) throw fetchErr;

    if (!rawPlaces || rawPlaces.length === 0) {
      console.log("No more places found in the table. Exiting.");
      const fs = await import('fs');
      await fs.promises.mkdir('scratch', { recursive: true }).catch(() => {});
      await fs.promises.writeFile('scratch/last_cursor_id.txt', '', 'utf8').catch(() => {});
      await browser.close();
      process.exit(0);
    }

    // 다음 배치를 위해 이번 배치의 마지막 ID를 파일에 써둡니다.
    const lastRecordId = rawPlaces[rawPlaces.length - 1].id;
    const fs = await import('fs');
    await fs.promises.mkdir('scratch', { recursive: true }).catch(() => {});
    await fs.promises.writeFile('scratch/last_cursor_id.txt', lastRecordId, 'utf8');

    // 메모리 상에서 미시도 건 필터링 (enriched 플래그가 없는 것만)
    const places = rawPlaces.filter(p => p.raw_data?.enriched === undefined || p.raw_data?.enriched === null);

    if (places.length === 0) {
      console.log(`All ${rawPlaces.length} places in this cursor batch are already enriched. Skipping Playwright.`);
      await browser.close();
      process.exit(0);
    }

    console.log(`Found ${places.length} places to enrich out of ${rawPlaces.length} scanned.`);

    // 2단계: 병렬 배치 분할 크롤링
    for (let i = 0; i < places.length; i += concurrency) {
      // 카테고리별 연속 실패 임계치 도달 시 전체 프로세스 강제 중단 및 긴급 보고
      const abortedCategory = getAbortedCategory();
      if (abortedCategory) {
        console.error(`\n🚨 [ABORT] Consecutive failure threshold (${maxConsecutiveFailures}) reached for category [${abortedCategory}]. Terminating batch to prevent IP block.`);
        break;
      }

      const chunk = places.slice(i, i + concurrency);
      
      await Promise.all(chunk.map(async (place) => {
        const name = place.name;
        const address = place.address || '';
        const category = place.category === 'ROUTE_CAFE' ? 'ROUTE_CAFE' : place.category === 'MART' ? 'MART' : 'RESTAURANT';
        const defaultFallback = { ...CATEGORY_FALLBACKS[category] };
        let placeUrl = place.raw_data?.place_url || place.raw_data?.placeUrl || place.raw_data?.kakao_url;
        let details = null;
        let success = false;

        try {
          // 1. place_url이 없으면 검색
          if (!placeUrl) {
            const searchResult = await searchLocalUnified(name, address, place.lat, place.lng);
            if (searchResult) {
              placeUrl = searchResult.place_url;
            }
          }

          let kakaoId = '';
          if (placeUrl && placeUrl.includes('place.map.kakao.com/')) {
            const parts = placeUrl.split('/');
            kakaoId = parts[parts.length - 1];
          }

          // 2. Playwright 고속 크롤러 실행
          if (kakaoId) {
            details = await scrapeKakaoPlaceDetailsFast(browser, kakaoId);
          }

          // 3. 수집 결과 검증 및 데이터 적재 제어
          const operating_hours = details?.operating_hours || defaultFallback.operating_hours;
          const closed_days = details?.closed_days || defaultFallback.closed_days;
          const parking_available = details?.parking_available || defaultFallback.parking_available;
          const representative_menu = details?.representative_menu || defaultFallback.representative_menu;
          const pet_friendly = details?.pet_friendly || defaultFallback.pet_friendly;
          const homepage_url = details?.homepage_url || place.raw_data?.homepage_url || '';

          // 데이터 정밀 수집 여부 체크 (기본 폴백 정보와 완전히 다른 실제 세부 정보가 수집되었는지 검증)
          const isRealEnriched = checkRealEnriched(category, details);
          
          if (isRealEnriched) {
            consecutiveFailuresByCategory[category] = 0; // 실 데이터가 정상 적재되면 해당 카테고리 연속 실패 카운트 리셋
            success = true;
          } else {
            consecutiveFailuresByCategory[category]++; // 폴백 데이터 매핑 및 수집 실패 시 해당 카테고리 실패 카운트 누적
            console.warn(`  [WARN] Fallback mapped or details missing for: ${name} (${category}) (Consecutive: ${consecutiveFailuresByCategory[category]})`);
          }

          const updatedRaw = {
            ...(place.raw_data || {}),
            enriched: isRealEnriched, // 무조건 true가 아닌 실제 상세 수집 여부를 대입
            place_url: placeUrl || place.raw_data?.place_url,
            operating_hours,
            closed_days,
            parking_available,
            representative_menu,
            pet_friendly,
            homepage_url
          };

          // 4. 버퍼 누적 (1,000건 단위 벌크 Upsert 용)
          buffer.push({
            id: place.id,
            api_source: place.api_source || place.raw_data?.api_source || place.raw_data?.apiSource || 'FAST_BULK_PLAYWRIGHT',
            category: place.category,
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            description: place.description || defaultFallback.description.replace('${name}', name),
            raw_data: updatedRaw,
            updated_at: new Date().toISOString()
          });

          if (success) {
            successCount++;
            processedList.push(`${name} (${category})`);
            console.log(`  [OK] Processed: ${name}`);
          } else {
            failCount++;
          }

        } catch (err) {
          console.error(`  [FAIL] Failed to process ${name}: ${err.message}`);
          consecutiveFailuresByCategory[category]++;
          failCount++;

          // ⭐️ 예외 에러 발생 시에도 updated_at을 현재 시점으로 터치하여 중복 수집 루프 회피하도록 버퍼에 강제 반영
          buffer.push({
            id: place.id,
            api_source: place.api_source || place.raw_data?.api_source || place.raw_data?.apiSource || 'FAST_BULK_PLAYWRIGHT',
            category: place.category,
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            description: place.description,
            raw_data: {
              ...(place.raw_data || {}),
              enrich_error: err.message
            },
            updated_at: new Date().toISOString()
          });
        }
      }));

      // IP 차단을 피하기 위한 스마트 지연 (500ms ~ 1000ms 분산 지연)
      const delay = 500 + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));

      // 1,000건 버퍼 차면 벌크 Upsert 실행
      if (buffer.length >= 1000) {
        console.log(`\n⏳ Writing 1000 items bulk chunk to Supabase...`);
        const { error: upsertErr } = await supabase
          .from('master_places')
          .upsert(buffer, { onConflict: 'id' });

        if (upsertErr) {
          console.error(`❌ Bulk upsert failed: ${upsertErr.message}`);
        } else {
          console.log(`✅ Bulk upsert successful!`);
        }
        buffer.length = 0; // 버퍼 비우기
      }
    }

    // 루프 종료 후 남은 버퍼 잔량 최종 적재
    if (buffer.length > 0 && !consecutiveFailureCheck()) {
      console.log(`\n⏳ Writing remaining ${buffer.length} items bulk chunk to Supabase...`);
      const { error: upsertErr } = await supabase
        .from('master_places')
        .upsert(buffer, { onConflict: 'id' });

      if (upsertErr) {
        console.error(`❌ Final bulk upsert failed: ${upsertErr.message}`);
      } else {
        console.log(`✅ Final bulk upsert successful!`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n=== Fast Playwright Bulk Enrichment completed ===`);
    console.log(`Success: ${successCount} items`);
    console.log(`Failed: ${failCount} items`);
    console.log(`Total duration: ${(duration / 1000).toFixed(2)} seconds`);

    // automation_logs 에 수행 결과 기록
    const abortedCat = getAbortedCategory();
    await supabase.from('automation_logs').insert({
      job_name: 'DAILY_MASTER_ENRICHMENT',
      status: consecutiveFailureCheck() ? 'FAILURE' : (successCount > 0 ? 'SUCCESS' : 'FAILURE'),
      processed_count: successCount,
      message: consecutiveFailureCheck()
        ? `상세정보 적재 오류 임계값 도달로 강제 중단 (장애 카테고리: ${abortedCat}). 성공 ${successCount}건, 실패 ${failCount}건.`
        : `Playwright 고속화 상세정보 벌크 재적재 완료: 성공 ${successCount}건, 실패 ${failCount}건.`,
      duration_ms: duration,
      api_status: {
        attempted: successCount + failCount,
        success: successCount,
        failed: failCount,
        aborted_category: abortedCat || null,
        processed: processedList
      },
      created_at: new Date().toISOString()
    });

    if (consecutiveFailureCheck()) {
      process.exit(1);
    }

  } catch (err) {
    console.error("Fatal error during bulk enrichment:", err.message);
    await browser.close();
    process.exit(1);
  } finally {
    await browser.close();
  }

  function consecutiveFailureCheck() {
    return getAbortedCategory() !== undefined;
  }
}

runBulkEnrich();
