import fetch from 'node-fetch';

async function testLXSite() {
  const url = 'https://www.lx.or.kr/lx/index.do';
  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
  };

  try {
    console.log(`📡 Testing LX Official Site at: ${url}`);
    const response = await fetch(url, { headers, timeout: 5000 });
    console.log(`✅ Status: ${response.status} ${response.statusText}`);
  } catch (error) {
    console.error(`💥 Execution Error: ${error.message}`);
  }
}

testLXSite();
