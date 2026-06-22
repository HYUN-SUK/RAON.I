import { chromium } from 'playwright';

let browser = null;

/**
 * 전역 브라우저 인스턴스를 초기화합니다. (리소스 재사용)
 */
export async function initBrowser() {
  if (!browser) {
    browser = await chromium.launch({
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-accelerated-2d-canvas',
        '--disable-gpu'
      ]
    });
  }
  return browser;
}

/**
 * 전역 브라우저 인스턴스를 닫습니다.
 */
export async function closeBrowser() {
  if (browser) {
    await browser.close();
    browser = null;
  }
}

/**
 * 카카오 맵 상세페이지에서 상세 속성들을 동적 스크래핑합니다.
 * @param {string} placeId 카카오 Place ID
 */
export async function scrapeKakaoPlaceDetails(placeId) {
  const url = `https://place.map.kakao.com/m/${placeId}`;
  let context = null;
  let page = null;
  
  try {
    const activeBrowser = await initBrowser();
    context = await activeBrowser.newContext({
      userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1',
      viewport: { width: 375, height: 812 },
      isMobile: true
    });
    
    page = await context.newPage();

    await page.goto(url, { waitUntil: 'networkidle', timeout: 10000 });
    
    // React 동적 컴포넌트 렌더 완료 대기
    await page.waitForTimeout(1500);
    
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
          price = price.replace(/\s+/g, ' '); // 공백 줄바꿈 정리
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
    console.error(`[Playwright Scraper Error] placeId: ${placeId}, msg: ${err.message}`);
    return null;
  } finally {
    if (page) await page.close().catch(() => {});
    if (context) await context.close().catch(() => {});
  }
}
