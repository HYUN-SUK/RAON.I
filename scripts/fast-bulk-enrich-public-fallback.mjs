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

const CATEGORY_FALLBACKS = {
  SPOT: {
    operating_hours: "상시 개방 또는 정보 없음",
    closed_days: "연중무휴 또는 정보 없음",
    admission_fee: "무료 또는 현장 확인 필요",
    parking_available: "확인 불가",
    kids_friendly: "확인 불가",
    disabled_accessible: "확인 불가 (사전 확인 권장)",
    description: "${name}은(는) 해당 지역의 대표적인 관광명소입니다. 방문 전 개방 여부를 확인해 주세요."
  },
  HOSPITAL: {
    operating_hours: "평일 09:00 - 18:00 (전화 확인 권장)",
    closed_days: "일요일/공휴일 휴무 (응급실 제외)",
    emergency_room: "확인 불가 (119 또는 유선 문의)",
    parking_available: "주차 가능",
    representative_departments: [],
    description: "${name}은(는) 해당 지역의 의료 시설입니다. 응급 상황 시 유선 연락 후 방문하세요."
  },
  FESTIVAL: {
    festival_period: { "start": "일정 확인 필요", "end": "일정 확인 필요" },
    operating_hours: "행사별 상이",
    admission_fee: "무료 또는 현장 확인 필요",
    homepage_url: "",
    organizer_contact: "정보 없음",
    parking_available: "확인 불가",
    description: "${name}은(는) 해당 지역에서 개최되는 축제/행사입니다."
  }
};

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
    
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    try {
      await page.waitForSelector('.txt_operation, .list_menu, .fold_detail, .wrap_storeetc, .list_addinfo', { timeout: 2500 });
    } catch (e) {
      await page.waitForTimeout(300);
    }
    
    const details = await page.evaluate(() => {
      let operating_hours = '';
      let closed_days = '';
      let parking_available = '확인 불가';
      let kids_friendly = '확인 불가';
      let disabled_accessible = '확인 불가';
      let homepage_url = '';
      let description = '';
      let admission_fee = '';
      
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
      
      const addInfos = document.querySelectorAll('.unit_default, .unit_infoetc, .wrap_storeetc div, .list_addinfo li');
      addInfos.forEach(unit => {
        const titEl = unit.querySelector('.tit_addinfo, .tit_infoetc');
        const infoEl = unit.querySelector('.detail_info, .txt_detail, .txt_infoetc');
        if (titEl && infoEl) {
          const title = titEl.innerText.trim();
          const value = infoEl.innerText.trim();
          if (title.includes('주차')) {
            parking_available = value;
          } else if (title.includes('유모차') || title.includes('아기')) {
            kids_friendly = value;
          } else if (title.includes('장애인') || title.includes('휠체어') || title.includes('무장애')) {
            disabled_accessible = value;
          } else if (title.includes('입장료') || title.includes('이용료') || title.includes('관람료')) {
            admission_fee = value;
          }
        }
      });
      
      const linkHomepage = document.querySelector('a.link_homepage, a.link_website, .link_homepage');
      if (linkHomepage) {
        homepage_url = linkHomepage.getAttribute('href') || linkHomepage.innerText.trim() || '';
      }

      const descEl = document.querySelector('.txt_introduce, .desc_introduce, .wrap_introduce');
      if (descEl) {
        description = descEl.innerText.trim();
      }
      
      return {
        operating_hours: operating_hours || undefined,
        closed_days: closed_days || undefined,
        parking_available: parking_available !== '확인 불가' ? parking_available : undefined,
        kids_friendly: kids_friendly !== '확인 불가' ? kids_friendly : undefined,
        disabled_accessible: disabled_accessible !== '확인 불가' ? disabled_accessible : undefined,
        admission_fee: admission_fee || undefined,
        homepage_url: homepage_url || undefined,
        description: description || undefined
      };
    });
    
    return details;
  } catch (err) {
    console.error(`[Playwright Fallback Error] placeId: ${placeId}, msg: ${err.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

async function runFallbackEnrich() {
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

  console.log(`[CLI Public Fallback Enrichment] Starting Playwright Scraper for Fallback places. Target Limit: ${limit}, Concurrency: ${concurrency}`);

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Fatal: Missing Supabase credentials.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const startTime = Date.now();

  let successCount = 0;
  let failCount = 0;
  
  const consecutiveFailuresByCategory = {
    SPOT: 0,
    HOSPITAL: 0,
    FESTIVAL: 0
  };
  const maxConsecutiveFailures = 10;

  function checkRealEnrichedKakaoSpot(category, details) {
    if (!details) return false;
    const fb = CATEGORY_FALLBACKS[category];
    if (!fb) return false;

    if (category === 'SPOT') {
      const hasRealHours = details.operating_hours && details.operating_hours !== fb.operating_hours;
      const hasRealParking = details.parking_available && details.parking_available !== fb.parking_available;
      const hasRealHomepage = details.homepage_url && details.homepage_url !== undefined && details.homepage_url !== '';
      const hasRealDesc = details.description && details.description !== undefined && details.description !== '';
      return !!(hasRealHours || hasRealParking || hasRealHomepage || hasRealDesc);
    }
    if (category === 'HOSPITAL') {
      const hasRealHours = details.operating_hours && details.operating_hours !== fb.operating_hours;
      const hasRealParking = details.parking_available && details.parking_available !== fb.parking_available;
      return !!(hasRealHours || hasRealParking);
    }
    if (category === 'FESTIVAL') {
      const hasRealHours = details.operating_hours && details.operating_hours !== fb.operating_hours;
      const hasRealPeriod = details.festival_period && details.festival_period.start !== fb.festival_period.start;
      return !!(hasRealHours || hasRealPeriod);
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
    console.log("Querying public fallback targets (where raw_data->enriched == false or null)...");
    let selectQuery = supabase
      .from('master_places')
      .select('id, name, address, lat, lng, category, raw_data, description')
      .eq('is_active', true)
      .in('category', ['SPOT', 'HOSPITAL', 'FESTIVAL'])
      .order('id');

    if (lastId) {
      selectQuery = selectQuery.gt('id', lastId);
    }

    const { data: rawPlaces, error: fetchErr } = await selectQuery.limit(limit);

    if (fetchErr) throw fetchErr;

    if (!rawPlaces || rawPlaces.length === 0) {
      console.log("No more public places found. Exiting.");
      const fs = await import('fs');
      await fs.promises.mkdir('scratch', { recursive: true }).catch(() => {});
      await fs.promises.writeFile('scratch/last_public_fallback_cursor_id.txt', '', 'utf8').catch(() => {});
      await browser.close();
      process.exit(0);
    }

    const lastRecordId = rawPlaces[rawPlaces.length - 1].id;
    const fs = await import('fs');
    await fs.promises.mkdir('scratch', { recursive: true }).catch(() => {});
    await fs.promises.writeFile('scratch/last_public_fallback_cursor_id.txt', lastRecordId, 'utf8');

    const places = rawPlaces.filter(p => p.raw_data?.enriched === false || p.raw_data?.enriched === undefined || p.raw_data?.enriched === null);

    if (places.length === 0) {
      console.log(`All ${rawPlaces.length} places in this cursor batch are already successfully enriched. Skipping Playwright.`);
      await browser.close();
      process.exit(0);
    }

    console.log(`Found ${places.length} fallback places to crawl out of ${rawPlaces.length} scanned.`);

    for (let i = 0; i < places.length; i += concurrency) {
      const abortedCategory = getAbortedCategory();
      if (abortedCategory) {
        console.error(`\n🚨 [ABORT] Consecutive failure threshold (${maxConsecutiveFailures}) reached for category [${abortedCategory}]. Terminating fallback crawler batch.`);
        break;
      }

      const chunk = places.slice(i, i + concurrency);
      
      await Promise.all(chunk.map(async (place) => {
        const name = place.name;
        const address = place.address || '';
        const category = place.category;
        const defaultFallback = { ...CATEGORY_FALLBACKS[category] };
        let placeUrl = place.raw_data?.place_url || place.raw_data?.placeUrl || place.raw_data?.kakao_url;
        let details = null;
        let success = false;

        try {
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

          if (kakaoId) {
            details = await scrapeKakaoPlaceDetailsFast(browser, kakaoId);
          }

          const operating_hours = details?.operating_hours || defaultFallback.operating_hours;
          const closed_days = details?.closed_days || defaultFallback.closed_days;
          const parking_available = details?.parking_available || defaultFallback.parking_available;
          const homepage_url = details?.homepage_url || place.raw_data?.homepage_url || '';
          
          const admission_fee = details?.admission_fee || defaultFallback.admission_fee;
          const kids_friendly = details?.kids_friendly || defaultFallback.kids_friendly;
          const disabled_accessible = details?.disabled_accessible || defaultFallback.disabled_accessible;

          const isRealEnriched = checkRealEnrichedKakaoSpot(category, details);
          
          if (isRealEnriched) {
            consecutiveFailuresByCategory[category] = 0;
            success = true;
          } else {
            consecutiveFailuresByCategory[category]++;
            console.warn(`  [WARN] Fallback mapped or details missing for public place: ${name} (${category}) (Consecutive: ${consecutiveFailuresByCategory[category]})`);
          }

          const updatedRaw = {
            ...(place.raw_data || {}),
            enriched: isRealEnriched,
            place_url: placeUrl || place.raw_data?.place_url,
            operating_hours,
            closed_days,
            parking_available,
            homepage_url,
            ...(category === 'SPOT' ? {
              admission_fee,
              kids_friendly,
              disabled_accessible
            } : {}),
            ...(category === 'HOSPITAL' ? {
              emergency_room: place.raw_data?.emergency_room || defaultFallback.emergency_room,
              representative_departments: place.raw_data?.representative_departments || defaultFallback.representative_departments
            } : {}),
            ...(category === 'FESTIVAL' ? {
              festival_period: place.raw_data?.festival_period || defaultFallback.festival_period,
              organizer_contact: place.raw_data?.organizer_contact || defaultFallback.organizer_contact
            } : {})
          };

          buffer.push({
            id: place.id,
            api_source: place.raw_data?.api_source || place.raw_data?.apiSource || 'PUBLIC_FALLBACK_CRAWLER',
            category: place.category,
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            description: details?.description || place.description || defaultFallback.description.replace('${name}', name),
            raw_data: updatedRaw,
            updated_at: new Date().toISOString()
          });

          if (success) {
            successCount++;
            processedList.push(`${name} (${category})`);
            console.log(`  [OK] Processed Fallback: ${name}`);
          } else {
            failCount++;
          }

        } catch (err) {
          console.error(`  [FAIL] Failed to process fallback ${name}: ${err.message}`);
          consecutiveFailuresByCategory[category]++;
          failCount++;

          buffer.push({
            id: place.id,
            api_source: place.raw_data?.api_source || place.raw_data?.apiSource || 'PUBLIC_FALLBACK_CRAWLER',
            category: place.category,
            name: place.name,
            address: place.address,
            lat: place.lat,
            lng: place.lng,
            description: place.description,
            raw_data: {
              ...(place.raw_data || {}),
              enriched: false,
              enrich_error: err.message
            },
            updated_at: new Date().toISOString()
          });
        }
      }));

      const delay = 500 + Math.random() * 500;
      await new Promise(r => setTimeout(r, delay));

      if (buffer.length >= 1000) {
        console.log(`\n⏳ Writing 1000 fallback items bulk chunk to Supabase...`);
        const { error: upsertErr } = await supabase
          .from('master_places')
          .upsert(buffer, { onConflict: 'id' });

        if (upsertErr) {
          console.error(`❌ Bulk upsert failed: ${upsertErr.message}`);
        } else {
          console.log(`✅ Bulk upsert successful!`);
        }
        buffer.length = 0;
      }
    }

    if (buffer.length > 0 && !consecutiveFailureCheck()) {
      console.log(`\n⏳ Writing remaining ${buffer.length} fallback items bulk chunk to Supabase...`);
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
    console.log(`\n=== Public Fallback Crawler completed ===`);
    console.log(`Success (Enriched): ${successCount} items`);
    console.log(`Failed (Fallback/Error): ${failCount} items`);
    console.log(`Total duration: ${(duration / 1000).toFixed(2)} seconds`);

    const abortedCat = getAbortedCategory();
    await supabase.from('automation_logs').insert({
      job_name: 'PUBLIC_FALLBACK_CRAWLER',
      status: consecutiveFailureCheck() ? 'FAILURE' : (successCount > 0 ? 'SUCCESS' : 'FAILURE'),
      processed_count: successCount,
      message: consecutiveFailureCheck()
        ? `공공 폴백 크롤링 오류 임계값 도달로 강제 중단 (장애 카테고리: ${abortedCat}). 성공 ${successCount}건, 실패 ${failCount}건.`
        : `공공 폴백 크롤러 이행 완료: 성공 ${successCount}건, 실패 ${failCount}건.`,
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
    console.error("Fatal error during fallback crawler:", err.message);
    await browser.close();
    process.exit(1);
  } finally {
    await browser.close();
  }

  function consecutiveFailureCheck() {
    return getAbortedCategory() !== undefined;
  }
}

runFallbackEnrich();
