import fetch from 'node-fetch';

async function testConnection() {
  const url = 'https://file.localdata.go.kr/file/download/excellent_restaurant_info/info?orgCode=6410000_ALL';
  console.log(`Connecting to LocalData server with Referer headers: ${url}...`);
  try {
    const startTime = Date.now();
    const res = await fetch(url, { 
      headers: { 
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.data.go.kr/'
      },
      timeout: 10000 // 10초 타임아웃
    });
    console.log(`Response Status: ${res.status} (${res.statusText})`);
    console.log(`Time taken: ${Date.now() - startTime}ms`);
    if (res.ok) {
      console.log("✅ Connection SUCCESS!");
    } else {
      console.log("❌ Connection FAILED but server responded. Body preview:");
      const text = await res.text();
      console.log(text.substring(0, 200));
    }
  } catch (e) {
    console.error("❌ Connection ERROR:", e.message);
  }
}

testConnection();
