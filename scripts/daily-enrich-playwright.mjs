import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import fs from 'fs';
import path from 'path';

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

function normalizeCategory(cat) {
  const c = String(cat).toUpperCase();
  if (c.includes('RESTAURANT') || c.includes('REST_')) return 'RESTAURANT';
  if (c.includes('CAFE')) return 'ROUTE_CAFE';
  if (c.includes('MART')) return 'MART';
  return 'RESTAURANT';
}

function normalizeName(str) {
  if (!str) return '';
  // HTML 태그 제거
  let s = str.replace(/<\/?[^>]+(>|$)/g, "");
  // HTML Entity 디코딩
  s = s.replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"');
  // 괄호 및 괄호 안의 지점명 제거 (예: 스타벅스(강남역점) -> 스타벅스)
  s = s.replace(/\([^)]+\)/g, '');
  // 공백 및 특수문자 제거
  s = s.replace(/[\s\-_,\/\\·'"]/g, '');
  return s.toLowerCase();
}

// Kakao search
async function searchKakao(query, lat, lng, radius = 10000) {
  if (!KAKAO_KEY) throw new Error("Missing KAKAO_REST_API_KEY");
  let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  if (lat && lng) {
    url += `&x=${lng}&y=${lat}&radius=${radius}`;
  }
  const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
  if (res.status === 429) throw new Error("KAKAO_QUOTA_EXCEEDED");
  if (!res.ok) throw new Error(`Kakao API Error (HTTP ${res.status})`);
  const data = await res.json();
  return data.documents || [];
}

// Naver search (Fallback)
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

// Switching search
async function searchLocalUnified(name, address, lat, lng) {
  const normTarget = normalizeName(name);
  let docs = [];

  try {
    // 1차 시도: 위경도가 있으면 반경 1.5km(1500m) 내에서 상호명으로 정밀 검색
    if (lat && lng) {
      docs = await searchKakao(name, lat, lng, 1500);
    }
  } catch (e) {
    console.warn(`[Search] Proximity search failed for ${name}: ${e.message}`);
  }

  // 2차 시도: 위경도가 없거나 1차 시도 검색 결과가 없으면 행정구역+상호명 키워드 검색
  if (docs.length === 0) {
    const cleanAddr = address.split(' ').slice(0, 3).join(' ');
    const query = `${cleanAddr} ${name}`;
    try {
      docs = await searchKakao(query, lat, lng, 10000);
    } catch (e) {
      console.warn(`[Search] Address search failed for ${name}: ${e.message}`);
    }
  }

  try {
    // 정규화 명칭 100% 매칭
    let matched = docs.find(d => normalizeName(d.place_name) === normTarget);

    // 완화된 매칭 (결과 이름에 검색어가 포함되거나 그 반대)
    if (!matched && docs.length > 0) {
      matched = docs.find(d => {
        const normResult = normalizeName(d.place_name);
        return normResult.includes(normTarget) || normTarget.includes(normResult);
      });
    }

    // 최종 매칭 결과 적용
    if (!matched && docs.length > 0) {
      matched = docs[0];
    }

    if (matched) {
      return { place_url: matched.place_url, phone: matched.phone };
    }
  } catch (e) {
    console.warn(`[Search Fallback] Kakao match failed: ${e.message}. Trying Naver...`);
  }

  // 네이버 플레이스 백업 검색
  try {
    const cleanAddr = address.split(' ').slice(0, 3).join(' ');
    const query = `${cleanAddr} ${name}`;
    const items = await searchNaver(query);
    let matched = items.find(i => normalizeName(i.title) === normTarget);

    if (!matched && items.length > 0) {
      matched = items.find(i => {
        const normResult = normalizeName(i.title);
        return normResult.includes(normTarget) || normTarget.includes(normResult);
      });
    }

    if (!matched && items.length > 0) {
      matched = items[0];
    }

    if (matched) {
      const cleanName = matched.title.replace(/<\/?[^>]+(>|$)/g, "");
      return {
        place_url: matched.link || `https://search.naver.com/search.naver?query=${encodeURIComponent(cleanName)}`,
        phone: matched.telephone
      };
    }
  } catch (ne) {
    console.error(`[Search Fallback] Naver failed: ${ne.message}`);
  }
  return null;
}

// Playwright scraper
async function scrapeKakaoPlaceDetailsFast(browser, placeId) {
  const url = `https://place.map.kakao.com/m/${placeId}`;
  let context = null;
  let page = null;
  
  try {
    context = await browser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812 },
      isMobile: true
    });
    
    page = await context.newPage();
    
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 8000 });
    
    try {
      await page.waitForSelector('.txt_operation, .list_menu, .fold_detail', { timeout: 2000 });
    } catch (e) {
      await page.waitForTimeout(300);
    }
    
    const details = await page.evaluate(() => {
      let operating_hours = '';
      let closed_days = '';
      let parking_available = '확인 불가';
      let pet_friendly = '확인 불가';
      let homepage_url = '';
      const representative_menu = [];
      
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
      
      const linkHomepage = document.querySelector('a.link_homepage, a.link_website, .link_homepage');
      if (linkHomepage) {
        homepage_url = linkHomepage.getAttribute('href') || linkHomepage.innerText.trim() || '';
      }
      
      const menuElements = document.querySelectorAll('.list_goods li, .list_menu li, .menu_board li, .menu_list li');
      menuElements.forEach(el => {
        const nameEl = el.querySelector('.tit_item, .txt_menu, .txt_menu_name, .tit_menu, .name_menu');
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
    console.error(`[Scrape Error] placeId: ${placeId}, msg: ${err.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

// Playwright 네이버 모바일 플레이스 상세 우회 수집 함수
async function scrapeNaverPlaceDetailsFast(activeBrowser, placeName, address) {
  const cleanAddr = address.split(' ').slice(0, 3).join(' ');
  const query = `${cleanAddr} ${placeName}`;
  const searchUrl = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
  
  let context = null;
  let page = null;
  
  try {
    context = await activeBrowser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812 },
      isMobile: true
    });
    
    page = await context.newPage();
    
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font', 'stylesheet'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    const placeUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const found = links.find(l => l.href && (l.href.includes('m.place.naver.com/restaurant/') || l.href.includes('m.place.naver.com/place/')));
      return found ? found.href : null;
    });

    if (!placeUrl) {
      return null;
    }

    const targetUrl = placeUrl.split('?')[0];
    await page.goto(targetUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
    
    // 영업시간 상세 버튼 클릭 시도 (다양한 플레이스 버전 대응)
    await page.click('a[role="button"]:has-text("영업시간"), a[role="button"]:has-text("상세"), .g2OPC, .U7r6F').catch(() => {});
    await page.waitForTimeout(400);
    
    const details = await page.evaluate(() => {
      let operating_hours = '';
      const representative_menu = [];
      let parking_available = '확인 불가';
      
      const hoursEl = document.querySelector('.g2OPC, ._21l1g, .w94VO');
      if (hoursEl) {
        operating_hours = hoursEl.innerText.replace(/\n/g, ', ').trim();
      } else {
        const divList = Array.from(document.querySelectorAll('div, li'));
        const foundDiv = divList.find(d => d.innerText && d.innerText.includes('영업시간') && d.innerText.length < 150);
        if (foundDiv) {
          operating_hours = foundDiv.innerText.replace('영업시간', '').replace(/\n/g, ', ').trim();
        }
      }
      
      const menuEls = document.querySelectorAll('.nNn14, ._3yEbK, .menu_info');
      menuEls.forEach(el => {
        const nameEl = el.querySelector('.name, ._3yEbK, .menu_title');
        const priceEl = el.querySelector('.price, ._3t912, .menu_price');
        if (nameEl) {
          const name = nameEl.innerText.trim();
          const price = priceEl ? priceEl.innerText.trim() : '';
          representative_menu.push(`${name}${price ? ' (' + price + ')' : ''}`);
        }
      });
      
      if (representative_menu.length === 0) {
        const menuTexts = document.querySelectorAll('.menu_name, .txt_menu');
        menuTexts.forEach(el => {
          representative_menu.push(el.innerText.trim());
        });
      }

      const bodyText = document.body.innerText;
      if (bodyText.includes('주차 가능') || bodyText.includes('주차제공')) {
        parking_available = '주차 가능';
      } else if (bodyText.includes('주차 불가')) {
        parking_available = '주차 불가';
      }
      
      return {
        operating_hours: operating_hours || undefined,
        parking_available: parking_available !== '확인 불가' ? parking_available : undefined,
        representative_menu: representative_menu.length > 0 ? representative_menu.slice(0, 5) : undefined
      };
    });
    
    return details;
  } catch (err) {
    console.error(`[Naver Scrape Error] ${placeName}: ${err.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

// Compare function
function isChanged(oldRaw, newDetails) {
  if (!oldRaw) return true;
  
  const comp = (a, b) => {
    const clean = (val) => String(val || '').trim();
    return clean(a) !== clean(b);
  };

  const menuOld = JSON.stringify(oldRaw.representative_menu || []);
  const menuNew = JSON.stringify(newDetails.representative_menu || []);

  return (
    comp(oldRaw.operating_hours, newDetails.operating_hours) ||
    comp(oldRaw.closed_days, newDetails.closed_days) ||
    comp(oldRaw.parking_available, newDetails.parking_available) ||
    comp(oldRaw.pet_friendly, newDetails.pet_friendly) ||
    menuOld !== menuNew ||
    comp(oldRaw.homepage_url, newDetails.homepage_url)
  );
}

async function startEnrichment() {
  const startTime = Date.now();
  console.log(`=== Starting Daily Playwright enrichment session ===`);
  
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase configuration");
    process.exit(1);
  }
  
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  // --test 플래그 체크 및 수집 한도 설정
  const isTest = process.argv.includes('--test');
  const restLimit = isTest ? 2 : 250;
  const martLimit = isTest ? 1 : 50;
  const targetTotal = restLimit + martLimit;

  // 1. 커서 파일 로드
  const cursorDir = 'scratch';
  const cursorFile = path.join(cursorDir, 'last_enrich_cursor_id.txt');
  if (!fs.existsSync(cursorDir)) {
    fs.mkdirSync(cursorDir, { recursive: true });
  }
  let lastId = '';
  if (fs.existsSync(cursorFile)) {
    lastId = fs.readFileSync(cursorFile, 'utf8').trim();
  }
  
  console.log(`Cursor initialized. Last ID: [${lastId || 'START OF TABLE'}]`);

  const restCafes = [];
  const marts = [];
  let currentCursor = lastId;
  let loopProtect = 0;
  const queryLimit = 1000;

  // Supabase 타임아웃 우회를 위해 PK(id) 순서대로 1,000건씩 페이징 긁기
  // 이 방법은 정렬 연산이 들어가지 않아 supbase에서 0.1초만에 결과를 반환합니다.
  while (restCafes.length < restLimit || marts.length < martLimit) {
    loopProtect++;
    if (loopProtect > 100) {
      console.warn("Loop protection triggered. Exiting target collection.");
      break;
    }

    let query = supabase
      .from('master_places')
      .select('id, name, address, lat, lng, category, raw_data, description, miss_count')
      .eq('is_active', true)
      .order('id')
      .limit(queryLimit);

    if (currentCursor) {
      query = query.gt('id', currentCursor);
    }

    const { data, error } = await query;
    if (error) {
      console.error("DB Query error during collection:", error.message);
      process.exit(1);
    }

    if (!data || data.length === 0) {
      // 테이블 끝에 도달했을 때: 커서를 비우고 처음부터 다시 돌기
      console.log("Reached end of master_places table. Resetting cursor to start.");
      currentCursor = '';
      continue;
    }

    // 메모리 필터링
    for (const place of data) {
      const cat = place.category;
      if (['RESTAURANT', 'ROUTE_CAFE'].includes(cat) && restCafes.length < restLimit) {
        restCafes.push(place);
      } else if (cat === 'MART' && marts.length < martLimit) {
        marts.push(place);
      }
    }

    // 커서 진전
    currentCursor = data[data.length - 1].id;
  }

  const targets = [...restCafes, ...marts];
  console.log(`Collected ${targets.length} targets (Restaurants/Cafes: ${restCafes.length}/${restLimit}, Marts: ${marts.length}/${martLimit})`);

  if (targets.length === 0) {
    console.log("No targets found for enrichment. Exiting.");
    process.exit(0);
  }

  // 2. Playwright 브라우저 기동
  console.log("Launching headless browser...");
  const browser = await chromium.launch({ headless: true });
  
  let successCount = 0;
  let skippedCount = 0;
  let failedCount = 0;
  let deactivatedCount = 0;
  const processedList = [];

  // 순차 크롤링 기동
  for (let i = 0; i < targets.length; i++) {
    const place = targets[i];
    console.log(`[Processing #${i + 1}/${targets.length}] ${place.name} (${place.category}) - ID: ${place.id}`);
    
    const name = place.name;
    const address = place.address || '';
    let placeUrl = place.raw_data?.place_url || place.raw_data?.placeUrl || place.raw_data?.kakao_url;
    let scrapSuccess = false;
    let newDetails = null;

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
        newDetails = await scrapeKakaoPlaceDetailsFast(browser, kakaoId);
        if (newDetails) {
          scrapSuccess = true;
        }
      }

      // 2.5. 네이버 플레이스 2차 스위칭 폴백 연동 개발 반영
      const normCat = normalizeCategory(place.category);
      const checkRealEnriched = (category, details) => {
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
      };

      const isRealEnriched = checkRealEnriched(normCat, newDetails);

      if (!isRealEnriched && ['RESTAURANT', 'ROUTE_CAFE', 'MART'].includes(normCat)) {
        console.log(`    [Naver Switch] Details missing on Kakao for ${name}. Attempting Naver Place...`);
        const naverDetails = await scrapeNaverPlaceDetailsFast(browser, name, address);
        if (naverDetails && checkRealEnriched(normCat, naverDetails)) {
          console.log(`    [Naver Switch OK] Successfully enriched ${name} via Naver!`);
          newDetails = {
            ...newDetails,
            ...naverDetails,
            operating_hours: naverDetails.operating_hours || newDetails?.operating_hours,
            parking_available: naverDetails.parking_available || newDetails?.parking_available,
            representative_menu: naverDetails.representative_menu || newDetails?.representative_menu
          };
          scrapSuccess = true;
        }
      }
    } catch (err) {
      console.warn(`    ⚠️ Crawler failed for ${name}: ${err.message}`);
    }

    const curTimeStr = new Date().toISOString();

    if (scrapSuccess && newDetails) {
      const normCat = normalizeCategory(place.category);
      const fallback = CATEGORY_FALLBACKS[normCat];
      
      const mergedDetails = {
        operating_hours: newDetails.operating_hours || fallback.operating_hours,
        closed_days: newDetails.closed_days || fallback.closed_days,
        representative_menu: newDetails.representative_menu || fallback.representative_menu,
        parking_available: newDetails.parking_available || fallback.parking_available,
        pet_friendly: newDetails.pet_friendly || fallback.pet_friendly,
        homepage_url: newDetails.homepage_url || ""
      };

      const hasChange = isChanged(place.raw_data, mergedDetails);

      if (hasChange) {
        console.log(`    ✅ Success: Data changed. Updating DB record.`);
        const updatedRaw = {
          ...(place.raw_data || {}),
          ...mergedDetails,
          enriched: true,
          place_url: placeUrl || place.raw_data?.place_url
        };

        const { error: updErr } = await supabase
          .from('master_places')
          .update({
            raw_data: updatedRaw,
            updated_at: curTimeStr,
            miss_count: 0
          })
          .eq('id', place.id);

        if (updErr) {
          console.error(`    ❌ DB Update Error: ${updErr.message}`);
          failedCount++;
        } else {
          successCount++;
          processedList.push({ name, status: 'UPDATED', category: place.category });
        }
      } else {
        console.log(`    💤 Skipped: Data is identical. Moving to back of the queue.`);
        const { error: skipErr } = await supabase
          .from('master_places')
          .update({
            updated_at: curTimeStr,
            miss_count: 0
          })
          .eq('id', place.id);

        if (skipErr) {
          console.error(`    ❌ DB Timestamp-only Update Error: ${skipErr.message}`);
          failedCount++;
        } else {
          skippedCount++;
          processedList.push({ name, status: 'SKIPPED', category: place.category });
        }
      }
    } else {
      // ⚠️ 수집 실패 (카카오맵 존재하지 않음, 폐업, 통신장애 등)
      // 사용자의 엄격한 피드백 반영: 실패하더라도 updated_at을 최신화하여 순회 큐의 맨 뒤로 밀어내어 Stuck 방지
      const newMissCount = (place.miss_count || 0) + 1;
      const willDeactivate = newMissCount >= 3;
      
      console.log(`    ⚠️ Failure (Miss #${newMissCount}/${willDeactivate ? 'Deactivating' : '3'}). Moving to back of queue.`);

      const updatePayload = {
        updated_at: curTimeStr,
        miss_count: newMissCount
      };

      if (willDeactivate) {
        updatePayload.is_active = false;
        deactivatedCount++;
        console.log(`    🚨 [DEACTIVATION] Place ${name} has failed 3 consecutive times. Set is_active = false.`);
      }

      const { error: failErr } = await supabase
        .from('master_places')
        .update(updatePayload)
        .eq('id', place.id);

      if (failErr) {
        console.error(`    ❌ DB Failure Update Error: ${failErr.message}`);
      }
      
      failedCount++;
      processedList.push({ name, status: willDeactivate ? 'DEACTIVATED' : 'FAILED', category: place.category });
    }

    const randomDelay = 1500 + Math.random() * 1500;
    await new Promise(r => setTimeout(r, randomDelay));
  }

  await browser.close();

  // 3. 마지막 쿼리 cursor ID 저장
  fs.writeFileSync(cursorFile, currentCursor, 'utf8');
  console.log(`Cursor updated and saved: [${currentCursor}]`);

  const totalTime = Date.now() - startTime;
  console.log(`\n=== Enrichment session completed in ${Math.round(totalTime / 1000)}s ===`);
  console.log(`Total: ${targets.length} | Success (Updated): ${successCount} | Skipped: ${skippedCount} | Failed (Missed): ${failedCount} (Deactivated: ${deactivatedCount})`);

  // 4. automation_logs 기록
  try {
    await supabase.from('automation_logs').insert({
      job_name: 'DAILY_CRAWL_ENRICHMENT',
      status: (successCount + skippedCount) > 0 ? 'SUCCESS' : 'FAILURE',
      processed_count: successCount + skippedCount,
      message: `일일 식당/마트 상세 크롤링 갱신 완료: 성공(업데이트) ${successCount}건, 변동없음(스킵) ${skippedCount}건, 실패 ${failedCount}건 (3회 아웃 비활성화: ${deactivatedCount}건)`,
      duration_ms: totalTime,
      api_status: {
        total: targets.length,
        updated: successCount,
        skipped: skippedCount,
        failed: failedCount,
        deactivated: deactivatedCount,
        history: processedList.slice(0, 50)
      },
      created_at: new Date().toISOString()
    });
    console.log("Automation log inserted successfully.");
  } catch (err) {
    console.error("Failed to insert automation log:", err.message);
  }
}

startEnrichment();
