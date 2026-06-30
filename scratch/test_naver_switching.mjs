import { chromium } from 'playwright';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

async function scrapeNaverPlaceDetailsFast(activeBrowser, placeName, address) {
  const addrParts = address.split(' ');
  const cleanAddr = addrParts.length > 1 ? `${addrParts[1]}` : addrParts[0]; 
  const query = `${cleanAddr} ${placeName}`;
  const searchUrl = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(query)}`;
  
  console.log(`[Naver Switch Test] Querying Naver Search: "${searchUrl}" (Query: ${query})`);
  
  let context = null;
  let page = null;
  
  try {
    context = await activeBrowser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.5 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812 },
      deviceScaleFactor: 3,
      isMobile: true,
      hasTouch: true,
      locale: 'ko-KR',
      timezoneId: 'Asia/Seoul'
    });
    
    page = await context.newPage();
    
    // 리소스 차단을 제거하여 탐지 우회 (Akamai/Naver WAF 가드는 CSS/JS 미로드 시 봇으로 즉시 차단함)
    await page.goto(searchUrl, { waitUntil: 'networkidle', timeout: 15000 });
    
    const placeUrl = await page.evaluate(() => {
      const links = Array.from(document.querySelectorAll('a'));
      const found = links.find(l => l.href && (
        /(m\.place\.naver\.com\/(restaurant|place)\/\d+)/.test(l.href) ||
        l.href.includes('naver.me') ||
        (l.href.includes('m.place.naver.com/place/') && !l.href.includes('searchByAddress'))
      ));
      return found ? found.href : null;
    });

    if (!placeUrl) {
      console.log("  [Naver Switch Test] No Place Link found on search result page.");
      return null;
    }

    console.log(`  [Naver Switch Test] Found Naver Place Link: "${placeUrl}"`);
    
    let basePath = placeUrl.split('?')[0];
    if (basePath.endsWith('/')) {
      basePath = basePath.slice(0, -1);
    }
    if (basePath.endsWith('/home')) {
      basePath = basePath.replace(/\/home$/, '');
    }

    // 1. 정보 탭 진입 (/information)
    const infoUrl = `${basePath}/information`;
    console.log(`  [Naver Switch Test] Navigating to Info tab: "${infoUrl}"`);
    await page.goto(infoUrl, { waitUntil: 'networkidle', timeout: 15000 });
    await page.waitForTimeout(2000); 
    
    const infoText = await page.evaluate(() => document.body.innerText);
    console.log("\n=================== INFO BODY TEXT ===================");
    console.log(infoText.substring(0, 1000)); // 너무 기니까 1000자만 출력
    console.log("======================================================\n");

    const infoDetails = await page.evaluate(() => {
      let operating_hours = '';
      let parking_available = '확인 불가';
      
      const hoursEl = document.querySelector('.g2OPC, ._21l1g, .w94VO, .yId8A, .SF57A, .w94VO');
      if (hoursEl) {
        operating_hours = hoursEl.innerText.replace(/\n/g, ', ').trim();
      } else {
        const divList = Array.from(document.querySelectorAll('div, li, span, dl'));
        const foundDiv = divList.find(d => d.innerText && d.innerText.includes('영업시간') && d.innerText.length < 200);
        if (foundDiv) {
          operating_hours = foundDiv.innerText.replace('영업시간', '').replace(/\n/g, ', ').trim();
        }
      }
      
      const bodyText = document.body.innerText;
      if (bodyText.includes('주차 가능') || bodyText.includes('주차제공')) {
        parking_available = '주차 가능';
      } else if (bodyText.includes('주차 불가')) {
        parking_available = '주차 불가';
      }
      
      return { operating_hours, parking_available };
    });

    // 2. 메뉴 탭 진입 (/menu/list)
    const menuUrl = `${basePath}/menu/list`;
    console.log(`  [Naver Switch Test] Navigating to Menu tab: "${menuUrl}"`);
    await page.goto(menuUrl, { waitUntil: 'networkidle', timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(2000); 
    
    const menuText = await page.evaluate(() => document.body.innerText);
    console.log("\n=================== MENU BODY TEXT ===================");
    console.log(menuText.substring(0, 1000));
    console.log("======================================================\n");

    const menuDetails = await page.evaluate(() => {
      const representative_menu = [];
      const menuEls = document.querySelectorAll('.nNn14, ._3yEbK, .menu_info, .menu_entry, ._3yEbK, .E2BPC, .menu_title_wrap');
      menuEls.forEach(el => {
        const nameEl = el.querySelector('.name, ._3yEbK, .menu_title, .title, ._3yEbK, .menu_name');
        const priceEl = el.querySelector('.price, ._3t912, .menu_price, .price, .menu_price');
        if (nameEl) {
          const name = nameEl.innerText.trim();
          const price = priceEl ? priceEl.innerText.trim() : '';
          representative_menu.push(`${name}${price ? ' (' + price + ')' : ''}`);
        }
      });
      
      if (representative_menu.length === 0) {
        const menuTexts = document.querySelectorAll('.menu_name, .txt_menu, .name_menu, ._3yEbK, .menu_title');
        menuTexts.forEach(el => {
          representative_menu.push(el.innerText.trim());
        });
      }
      
      return { representative_menu };
    });
    
    return {
      operating_hours: infoDetails.operating_hours || undefined,
      parking_available: infoDetails.parking_available !== '확인 불가' ? infoDetails.parking_available : undefined,
      representative_menu: menuDetails.representative_menu.length > 0 ? menuDetails.representative_menu.slice(0, 5) : undefined
    };
  } catch (err) {
    console.error(`[Naver Scrape Error] ${placeName}: ${err.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}

async function test() {
  const browser = await chromium.launch({ headless: true });
  
  console.log("\n--- Testing case 1: 석양집 ---");
  const res1 = await scrapeNaverPlaceDetailsFast(browser, "석양집", "서울특별시 마포구 토정로37길 9");
  console.log("Scraped Result:", JSON.stringify(res1, null, 2));

  await browser.close();
}

test();
