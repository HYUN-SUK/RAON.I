import fetch from 'node-fetch';

async function test() {
  const url = "https://file.localdata.go.kr/file/download/excellent_restaurant_info/info?orgCode=6280000_ALL";
  console.log("Fetching URL:", url);
  try {
    const res = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': 'https://www.localdata.go.kr/'
      },
      timeout: 30000
    });
    console.log("Status:", res.status);
    console.log("Status Text:", res.statusText);
    console.log("Headers:", Object.fromEntries(res.headers.entries()));
    
    // 만약 zip이나 binary 파일이면 text가 깨지거나 에러날 수 있으므로 Buffer로 읽어서 체크
    const buffer = await res.buffer();
    console.log("Body length:", buffer.length);
    console.log("Preview (hex):", buffer.slice(0, 50).toString('hex'));
    console.log("Preview (text):", buffer.slice(0, 200).toString('utf8'));
  } catch (err) {
    console.error("Error:", err);
  }
}
test();
