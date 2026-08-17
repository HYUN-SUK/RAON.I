async function findOrgCodes() {
    console.log('--- 광주 / 전남 LocalData orgCode 탐색 ---');
    // 가능한 패턴 테스트
    const candidates = [
        '6290000_ALL', '6460000_ALL', 
        '6290000', '6460000',
        '629_ALL', '646_ALL',
        '2900000_ALL', '4600000_ALL',
        '29_ALL', '46_ALL',
        '62900000000_ALL', '64600000000_ALL',
        '29000_ALL', '46000_ALL',
        '6290000_01', '6460000_01'
    ];

    for (const c of candidates) {
        const url = `https://file.localdata.go.kr/file/download/excellent_restaurant_info/info?orgCode=${c}`;
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.localdata.go.kr/'
                }
            });
            console.log(`[orgCode: ${c}] -> HTTP ${res.status}`);
        } catch (e) {
            console.log(`[orgCode: ${c}] -> 에러: ${e.message}`);
        }
    }
}

findOrgCodes();
