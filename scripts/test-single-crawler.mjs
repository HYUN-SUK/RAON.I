/**
 * 마트 상세정보 품질 점검 스크립트
 * A유형(템플릿), B유형(주소오염) 마트를 Playwright로 직접 크롤링하여
 * 현재 DB 데이터와 비교합니다.
 */
import { createClient } from '@supabase/supabase-js';
import { chromium } from 'playwright';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 카카오 검색
async function searchKakao(query, lat, lng, radius = 3000) {
  let url = `https://dapi.kakao.com/v2/local/search/keyword.json?query=${encodeURIComponent(query)}`;
  if (lat && lng) url += `&x=${lng}&y=${lat}&radius=${radius}`;
  const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
  const data = await res.json();
  return data.documents || [];
}

// 카카오 플레이스 스크래핑
async function scrapeKakaoPlace(browser, placeId) {
  const url = `https://place.map.kakao.com/m/${placeId}`;
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
    viewport: { width: 375, height: 812 }, isMobile: true
  });
  const page = await context.newPage();
  await page.route('**/*', r => ['image','media','font','stylesheet'].includes(r.request().resourceType()) ? r.abort() : r.continue());
  
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 10000 });
  try { await page.waitForSelector('.txt_operation, .list_menu, .fold_detail', { timeout: 3000 }); } catch(e) { await page.waitForTimeout(500); }
  
  const details = await page.evaluate(() => {
    let operating_hours = '';
    let closed_days = '';
    let parking_available = '확인 불가';
    const representative_menu = [];
    
    const foldDetail = document.querySelector('.fold_detail');
    if (foldDetail) {
      operating_hours = foldDetail.innerText.replace(/\n/g, ', ').trim();
      const matches = foldDetail.innerText.match(/([월화수목금토일]\([^)]+\))휴무일/);
      if (matches) closed_days = matches[1].trim() + ' 휴무';
    } else {
      const txtOp = document.querySelector('.txt_operation');
      if (txtOp) operating_hours = txtOp.innerText.trim();
    }
    
    const addInfos = document.querySelectorAll('.unit_default, .unit_infoetc, .wrap_storeetc div');
    addInfos.forEach(unit => {
      const titEl = unit.querySelector('.tit_addinfo');
      const infoEl = unit.querySelector('.detail_info, .txt_detail');
      if (titEl && infoEl) {
        const title = titEl.innerText.trim();
        const value = infoEl.innerText.trim();
        if (title.includes('주차')) parking_available = value;
      }
    });
    
    const menuEls = document.querySelectorAll('.list_goods li, .list_menu li');
    menuEls.forEach(el => {
      const nameEl = el.querySelector('.tit_item, .txt_menu, .name_menu');
      const priceEl = el.querySelector('.desc_item, .txt_price, .price_menu');
      if (nameEl) representative_menu.push(`${nameEl.innerText.trim()}${priceEl ? ' (' + priceEl.innerText.trim() + ')' : ''}`);
    });
    
    return { operating_hours, closed_days, parking_available, representative_menu };
  });
  
  await page.close();
  await context.close();
  return details;
}

// 네이버 플레이스 스크래핑
async function scrapeNaverPlace(browser, name, address) {
  const cleanAddr = address.split(' ').slice(0, 3).join(' ');
  const searchUrl = `https://m.search.naver.com/search.naver?query=${encodeURIComponent(cleanAddr + ' ' + name)}`;
  
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X)',
    viewport: { width: 375, height: 812 }, isMobile: true
  });
  const page = await context.newPage();
  await page.route('**/*', r => ['image','media','font','stylesheet'].includes(r.request().resourceType()) ? r.abort() : r.continue());
  
  await page.goto(searchUrl, { waitUntil: 'domcontentloaded', timeout: 10000 });
  
  const placeUrl = await page.evaluate(() => {
    const links = Array.from(document.querySelectorAll('a'));
    const found = links.find(l => l.href && (l.href.includes('m.place.naver.com/restaurant/') || l.href.includes('m.place.naver.com/place/')));
    return found ? found.href : null;
  });

  if (!placeUrl) { await page.close(); await context.close(); return null; }
  
  await page.goto(placeUrl.split('?')[0], { waitUntil: 'domcontentloaded', timeout: 10000 });
  await page.click('a[role="button"]:has-text("영업시간"), a[role="button"]:has-text("상세")').catch(() => {});
  await page.waitForTimeout(500);
  
  const details = await page.evaluate(() => {
    let operating_hours = '';
    let parking_available = '확인 불가';
    
    const hoursEl = document.querySelector('.g2OPC, ._21l1g, .w94VO');
    if (hoursEl) operating_hours = hoursEl.innerText.replace(/\n/g, ', ').trim();
    
    const bodyText = document.body.innerText;
    if (bodyText.includes('주차 가능') || bodyText.includes('주차제공')) parking_available = '주차 가능';
    else if (bodyText.includes('주차 불가')) parking_available = '주차 불가';
    
    return { operating_hours, parking_available };
  });
  
  await page.close();
  await context.close();
  return details;
}

async function main() {
  // A유형: 노브랜드 여주한글시장점 (템플릿 데이터)
  // B유형: 우리마트 (주소 오염)
  // C유형(대조군): 홈플러스 강동점 (실제 크롤링 데이터)
  
  const testTargets = [
    { label: 'A유형(템플릿)', name: '노브랜드 여주한글시장점', address: '경기도 여주시', lat: 37.2937, lng: 127.6347 },
    { label: 'B유형(주소오염)', name: '우리마트', address: '서울특별시 강남구 개포동', lat: 37.4832, lng: 127.0482 },
    { label: 'C유형(대조군)', name: '홈플러스 강동점', address: '서울특별시 강동구', lat: 37.5325, lng: 127.1310 }
  ];
  
  console.log('=== 마트 상세정보 품질 점검 시작 ===\n');
  
  const browser = await chromium.launch({ headless: true });
  
  for (const target of testTargets) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔍 [${target.label}] ${target.name}`);
    console.log(`${'='.repeat(60)}`);
    
    // 1. 카카오 검색으로 placeId 추출
    let kakaoId = null;
    try {
      const docs = await searchKakao(target.name, target.lat, target.lng, 5000);
      if (docs.length > 0) {
        const match = docs[0];
        kakaoId = match.id;
        console.log(`  카카오 검색 매칭: ${match.place_name} (ID: ${kakaoId})`);
        console.log(`  카카오 URL: https://place.map.kakao.com/${kakaoId}`);
      } else {
        console.log(`  ⚠️ 카카오 검색 결과 없음`);
      }
    } catch(e) {
      console.log(`  ❌ 카카오 검색 에러: ${e.message}`);
    }
    
    // 2. 카카오 플레이스 Playwright 크롤링
    if (kakaoId) {
      console.log(`\n  --- 카카오 플레이스 Playwright 크롤링 결과 ---`);
      try {
        const kakaoDetails = await scrapeKakaoPlace(browser, kakaoId);
        console.log(`  영업시간: ${kakaoDetails.operating_hours || '(없음)'}`);
        console.log(`  휴무일: ${kakaoDetails.closed_days || '(없음)'}`);
        console.log(`  주차: ${kakaoDetails.parking_available || '(없음)'}`);
        console.log(`  메뉴: ${kakaoDetails.representative_menu?.length > 0 ? kakaoDetails.representative_menu.join(', ') : '(없음)'}`);
      } catch(e) {
        console.log(`  ❌ 카카오 스크래핑 에러: ${e.message}`);
      }
    }
    
    // 3. 네이버 플레이스 Playwright 크롤링
    console.log(`\n  --- 네이버 플레이스 Playwright 크롤링 결과 ---`);
    try {
      const naverDetails = await scrapeNaverPlace(browser, target.name, target.address);
      if (naverDetails) {
        console.log(`  영업시간: ${naverDetails.operating_hours || '(없음)'}`);
        console.log(`  주차: ${naverDetails.parking_available || '(없음)'}`);
      } else {
        console.log(`  ⚠️ 네이버 플레이스 매칭 결과 없음`);
      }
    } catch(e) {
      console.log(`  ❌ 네이버 스크래핑 에러: ${e.message}`);
    }
  }
  
  await browser.close();
  console.log('\n=== 점검 완료 ===');
}

main().catch(e => { console.error(e); process.exit(1); });
