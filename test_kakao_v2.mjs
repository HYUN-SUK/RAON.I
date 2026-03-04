const KAKAO_KEY = '0de009e54e7ffaf137832064c797f650';

async function testKakao() {
    // 예산군 좌표
    const lng = 126.84;
    const lat = 36.67;

    const url2 = `https://dapi.kakao.com/v2/local/geo/transcoord.json?x=${lng}&y=${lat}&input_coord=WGS84&output_coord=WCONGNAMUL`;
    try {
        const res = await fetch(url2, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
        const data = await res.json();
        console.log("WCONGNAMUL:", JSON.stringify(data));
    } catch (e) { console.error(e); }
}

testKakao();
