import fetch from 'node-fetch';
import * as cheerio from 'cheerio';

async function dump() {
  const url = 'https://place.map.kakao.com/m/15942374'; // 도라지식당 모바일 웹
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 14_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/14.0.3 Mobile/15E148 Safari/604.1'
      }
    });
    const html = await res.text();
    const $ = cheerio.load(html);

    console.log("Analyzing HTML structure of Kakao Mobile page...");
    
    // 텍스트 내용들을 뒤져서 영업시간이나 주차, 메뉴 관련 단어가 포함된 태그의 class/id 탐색
    console.log("\n1. Searching for operation hours keywords ('영업시간', '매일', '오전' 등)...");
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      const tagName = el.name;
      const className = $(el).attr('class') || '';
      
      if (tagName !== 'script' && tagName !== 'style' && (text.includes('매일') || text.includes('영업시간') || text.includes('휴무') || text.includes('쉬는'))) {
        // 부모-자식 관계가 많으므로 너무 길지 않은 텍스트만 출력
        if (text.length < 100) {
          console.log(`Tag: <${tagName} class="${className}"> -> "${text}"`);
        }
      }
    });

    console.log("\n2. Searching for parking keywords ('주차', '주차장' 등)...");
    $('*').each((i, el) => {
      const text = $(el).text().trim();
      const tagName = el.name;
      const className = $(el).attr('class') || '';
      
      if (tagName !== 'script' && tagName !== 'style' && (text.includes('주차') || text.includes('발렛'))) {
        if (text.length < 100) {
          console.log(`Tag: <${tagName} class="${className}"> -> "${text}"`);
        }
      }
    });

  } catch (e) {
    console.error("Error:", e.message);
  }
}

dump();
