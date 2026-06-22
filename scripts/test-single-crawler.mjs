import { scrapeKakaoPlaceDetails, closeBrowser } from './utils/scraper.mjs';

async function test() {
  const testId = '15942374'; // 도라지식당 카카오 ID
  console.log(`Testing Playwright detail crawling for place ID: ${testId}...`);

  const result = await scrapeKakaoPlaceDetails(testId);
  console.log(`Scrape Result:`, JSON.stringify(result, null, 2));

  await closeBrowser();
}

test();
