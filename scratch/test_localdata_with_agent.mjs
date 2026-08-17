import https from 'https';

const httpsAgent = new https.Agent({
    rejectUnauthorized: false
});

async function testWithAgent() {
    console.log('--- httpsAgent 적용 테스트 ---');
    const sidos = ['6110000_ALL', '6290000_ALL', '6460000_ALL'];
    for (const oc of sidos) {
        const url = `https://file.localdata.go.kr/file/download/excellent_restaurant_info/info?orgCode=${oc}`;
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.localdata.go.kr/',
                    'Accept': '*/*'
                },
                agent: httpsAgent
            });
            console.log(`[orgCode: ${oc}] -> HTTP ${res.status}`);
        } catch (e) {
            console.log(`[orgCode: ${oc}] -> 실패: ${e.message}`);
        }
    }
}

testWithAgent();
