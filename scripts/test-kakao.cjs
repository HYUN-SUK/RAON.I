const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function testKakao() {
    const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
    console.log("KAKAO_KEY:", KAKAO_KEY ? "EXISTS" : "MISSING");
    
    const address = "경상북도 포항시 북구 우창동로 33";
    try {
        const res = await fetch(`https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(address)}`, {
            headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
        });
        const data = await res.json();
        console.log("Kakao Status:", res.status);
        console.log("Response:", JSON.stringify(data, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}

testKakao();
