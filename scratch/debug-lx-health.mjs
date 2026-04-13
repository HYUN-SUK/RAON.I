import fetch from 'node-fetch';

async function testLXHealth() {
  const url = 'https://www.data.go.kr/data/3069176/fileData.do';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
    'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7'
  };

  try {
    console.log(`📡 Testing LX Health at: ${url}`);
    const response = await fetch(url, { headers });
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
    
    if (!response.ok) {
      const text = await response.text();
      console.log(`❌ Error Body (First 200 chars): ${text.substring(0, 200)}`);
    }
  } catch (error) {
    console.error(`💥 Execution Error: ${error.message}`);
  }
}

testLXHealth();
