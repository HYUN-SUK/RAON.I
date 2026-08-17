async function testLocalData() {
    console.log('--- 1. 행안부 LocalData 직접 다운로드 테스트 ---');
    const endpoints = [
        { path: 'excellent_restaurant_info', name: '모범음식점' },
        { path: 'large_scale_retail_stores', name: '대규모점포' },
        { path: 'other_food_retailers', name: '기타식품' }
    ];
    const orgCodes = ['6290000_ALL', '6460000_ALL', '6460000'];

    for (const ep of endpoints) {
        for (const oc of orgCodes) {
            const directUrl = `https://file.localdata.go.kr/file/download/${ep.path}/info?orgCode=${oc}`;
            try {
                const res = await fetch(directUrl, {
                    headers: {
                        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                        'Referer': 'https://www.localdata.go.kr/'
                    }
                });
                console.log(`[직접] ${ep.name} (${oc}) -> HTTP ${res.status} | Content-Type: ${res.headers.get('content-type')} | Size: ${res.headers.get('content-length')}`);
            } catch (e) {
                console.log(`[직접] ${ep.name} (${oc}) -> 실패: ${e.message}`);
            }
        }
    }

    console.log('\n--- 2. Vercel 배포 도메인 localdata-proxy 경유 테스트 ---');
    const proxyUrl = `https://raon-i.vercel.app/api/cron/localdata-proxy?path=excellent_restaurant_info&orgCode=6460000_ALL`;
    try {
        const res = await fetch(proxyUrl);
        console.log(`[프록시 raon-i.vercel.app] HTTP ${res.status}`);
        const text = await res.text();
        console.log(`[프록시 본문 요약]: ${text.slice(0, 200)}`);
    } catch (e) {
        console.log(`[프록시] 실패: ${e.message}`);
    }

    const proxyUrlCoKr = `https://raon-i.co.kr/api/cron/localdata-proxy?path=excellent_restaurant_info&orgCode=6460000_ALL`;
    try {
        const res = await fetch(proxyUrlCoKr);
        console.log(`[프록시 raon-i.co.kr] HTTP ${res.status}`);
        const text = await res.text();
        console.log(`[프록시 raon-i.co.kr 본문 요약]: ${text.slice(0, 200)}`);
    } catch (e) {
        console.log(`[프록시 raon-i.co.kr] 실패: ${e.message}`);
    }
}

testLocalData();
