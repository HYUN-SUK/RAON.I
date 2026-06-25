import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import { chromium } from 'playwright';
import fetch from 'node-fetch';

// Load .env.local from project root
const env = fs.readFileSync('.env.local', 'utf8');
const supabaseUrl = env.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const supabaseKey = env.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const kakaoApiKeyMatch = env.match(/KAKAO_REST_API_KEY=(.*)/) || env.match(/NEXT_PUBLIC_KAKAO_REST_API_KEY=(.*)/);
const kakaoApiKey = kakaoApiKeyMatch ? kakaoApiKeyMatch[1].trim() : null;

if (!kakaoApiKey) {
  console.error("❌ Missing KAKAO_REST_API_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);
const aliases = ['인천광역시', '인천'];

// Random delay helper
const delay = (ms) => new Promise(r => setTimeout(r, ms));
const randomDelay = () => delay(Math.floor(Math.random() * 1500) + 1500); // 1.5s ~ 3s

async function searchKakao(query, lat, lng) {
  let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  if (lat && lng) {
    url += `&x=${lng}&y=${lat}&radius=10000`;
  }
  const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${kakaoApiKey}` } });
  if (res.status === 429) throw new Error("KAKAO_QUOTA_EXCEEDED");
  if (!res.ok) throw new Error(`Kakao API Error (HTTP ${res.status})`);
  const data = await res.json();
  return data.documents || [];
}

async function findPlaceId(place) {
  const addr = (place.address || place.raw_data?.소재지주소 || place.raw_data?.도로명주소 || '').trim();
  const cleanAddr = addr ? addr.split(' ').slice(0, 3).join(' ') : '';
  
  const queries = [
    cleanAddr ? `${cleanAddr} ${place.name}` : null,
    place.sigungu ? `${place.sigungu} ${place.name}` : null,
    place.name
  ].filter(Boolean);

  for (const query of queries) {
    try {
      const docs = await searchKakao(query);
      if (docs.length === 0) continue;

      const cleanName = place.name.replace(/\s/g, '');
      const matched = docs.find(d => {
        const docName = d.place_name.replace(/\s/g, '');
        return docName.includes(cleanName) || cleanName.includes(docName);
      }) || docs[0];

      if (matched) {
        return {
          placeId: matched.id,
          phone: matched.phone || "",
          place_url: matched.place_url
        };
      }
    } catch (e) {
      console.error(`    ⚠️ Error querying Kakao API for [${place.name}]:`, e.message);
    }
  }
  return null;
}

// Playwright mobile detail scraper
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
    
    // Block heavy assets (images, media, fonts) but keep stylesheet to ensure no JS rendering crash
    await page.route('**/*', (route) => {
      const type = route.request().resourceType();
      if (['image', 'media', 'font'].includes(type)) {
        route.abort();
      } else {
        route.continue();
      }
    });

    await page.goto(url, { waitUntil: 'load', timeout: 12000 });
    
    // Fixed wait for Vue/React SPA rendering to complete
    await page.waitForTimeout(2500);
    
    const details = await page.evaluate(() => {
      let operating_hours = '정보 없음 (방문 전 확인 권장)';
      let closed_days = '연중무휴 또는 정보 없음';
      
      const bodyText = document.body.innerText;
      if (bodyText.includes('영업시간을 알려주세요') || bodyText.includes('영업정보를 알려주세요')) {
        return { operating_hours, closed_days };
      }

      const foldDetail = document.querySelector('.fold_detail');
      const txtOp = document.querySelector('.txt_operation');
      
      if (foldDetail) {
        const rawText = foldDetail.innerText.trim();
        // Exclude foldDetail that contains address or zip code
        if (!rawText.includes('지번 :') && !rawText.includes('우편번호')) {
          operating_hours = rawText.replace(/\n/g, ' ').trim();
          const matches = rawText.match(/([월화수목금토일]\([^)]+\))휴무일/);
          if (matches) {
            closed_days = matches[1].trim() + ' 휴무';
          }
        }
      } 
      
      if (operating_hours === '정보 없음 (방문 전 확인 권장)' && txtOp) {
        const rawText = txtOp.innerText.trim();
        if (!rawText.includes('영업시간을 알려주세요')) {
          operating_hours = rawText;
        }
      }
      
      // Validation: Must contain typical time symbols like '~' or ':' to be valid hours
      if (operating_hours !== '정보 없음 (방문 전 확인 권장)') {
        if (!operating_hours.includes('~') && !operating_hours.includes(':')) {
          operating_hours = '정보 없음 (방문 전 확인 권장)';
        }
      }
      
      return {
        operating_hours: operating_hours || undefined,
        closed_days: closed_days || undefined
      };
    });
    
    // Beautify the squeezed string (e.g. "수(6/24)11:00 ~ 21:00목(6/25)..." -> "수(6/24) 11:00 ~ 21:00, 목(6/25)...")
    if (details && details.operating_hours && details.operating_hours !== '정보 없음 (방문 전 확인 권장)') {
      let cleaned = details.operating_hours
        .replace(/([월화수목금토일])\((\d{1,2})\/(\d{1,2})\)/g, ', $1($2/$3) ')
        .replace(/([월화수목금토일])요일/g, ', $1요일')
        .replace(/([월화수목금토일])\s*~/g, ', $1 ~')
        .replace(/^,\s*/, '')
        .replace(/\s+/g, ' ')
        .trim();
      details.operating_hours = cleaned;
    }
    
    return details;
  } catch (err) {
    console.error(`      ❌ Playwright Scrape Error: ${err.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const limitArg = args.find(a => a.startsWith('--limit='))?.split('=')[1];
  const limitCount = limitArg ? parseInt(limitArg, 10) : (dryRun ? 5 : null);

  console.log(`🚀 [START] Incheon Playwright Detail Restoration (DryRun: ${dryRun})`);

  // 1. Fetch Incheon Restaurants/Marts that are missing detail info (having default fallback)
  console.log('  [1/3] Fetching targets from DB...');
  const targets = [];
  let pageNum = 0;
  const pageSize = 1000;
  while (pageNum < 15) {
    const { data: chunk, error } = await supabase
      .from('master_places')
      .select('id, name, sigungu, category, address, lat, lng, raw_data')
      .in('sido', aliases)
      .in('category', ['RESTAURANT', 'MART'])
      .range(pageNum * pageSize, (pageNum + 1) * pageSize - 1);

    if (error) {
      console.error('  ❌ DB Fetch Error:', error.message);
      return;
    }
    if (!chunk || chunk.length === 0) break;
    targets.push(...chunk);
    pageNum++;
  }

  // Filter: Exclude closed places and target fallback status
  const missingTargets = targets.filter(t => 
    (!t.raw_data || 
     !t.raw_data.place_url || 
     t.raw_data.operating_hours === '정보 없음 (방문 전 확인 권장)' || 
     !t.raw_data.operating_hours) &&
    (t.raw_data?.영업상태명 !== '폐업' && t.raw_data?.영업상태코드 !== '02' && t.raw_data?.영업상태명 !== '지정취소')
  );

  console.log(`  [INFO] Total Incheon Restaurants/Marts: ${targets.length}건 | Playwright Target: ${missingTargets.length}건`);
  
  const finalTargets = limitCount ? missingTargets.slice(0, limitCount) : missingTargets;
  if (finalTargets.length === 0) {
    console.log('  🎉 No targets to restore!');
    return;
  }

  console.log(`  [2/3] Launching Playwright Chromium...`);
  let browser = await chromium.launch({ headless: true });

  console.log(`  [3/3] Running search & scraping loop for ${finalTargets.length} items...`);
  let successCount = 0;
  let failCount = 0;

  for (let i = 0; i < finalTargets.length; i++) {
    const place = finalTargets[i];
    const addr = (place.address || place.raw_data?.소재지주소 || place.raw_data?.도로명주소 || '').trim();
    console.log(`    [${i+1}/${finalTargets.length}] Probing [${place.name}] (${addr})...`);

    const matchedInfo = await findPlaceId(place);
    if (matchedInfo) {
      console.log(`      🔗 Found matched placeId: ${matchedInfo.placeId}. Scraping details...`);
      const details = await scrapeKakaoPlaceDetailsFast(browser, matchedInfo.placeId);
      
      if (details) {
        console.log(`      ✨ Success! url: ${matchedInfo.place_url} | hours: ${details.operating_hours}`);
        
        if (!dryRun) {
          const currentRaw = place.raw_data || {};
          const updatedRaw = {
            ...currentRaw,
            place_url: matchedInfo.place_url,
            phone: matchedInfo.phone || currentRaw.phone,
            operating_hours: details.operating_hours,
            closed_days: details.closed_days
          };

          const { error: upErr } = await supabase
            .from('master_places')
            .update({ raw_data: updatedRaw })
            .eq('id', place.id);

          if (upErr) {
            console.error(`      ❌ DB Update Error:`, upErr.message);
            failCount++;
          } else {
            successCount++;
          }
        } else {
          successCount++;
        }
      } else {
        console.log(`      ❌ Playwright Scrape failed.`);
        failCount++;
      }
    } else {
      console.log(`      ❌ No match found in Kakao Local API.`);
      failCount++;
    }

    // Memory Guard
    if ((i + 1) % 300 === 0 && i + 1 < finalTargets.length) {
      console.log("    ♻️ Restarting browser instance...");
      await browser.close();
      browser = await chromium.launch({ headless: true });
    }

    await randomDelay();
  }

  await browser.close();
  console.log(`\n🏁 [FINISHED] Restoration completed. Success: ${successCount} | Fail: ${failCount}`);
}

main().catch(console.error);
