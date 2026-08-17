async function testOtherSidos() {
    const sidos = [
        { name: '서울', oc: '6110000_ALL' },
        { name: '경기', oc: '6410000_ALL' },
        { name: '부산', oc: '6260000_ALL' },
        { name: '강원', oc: '6530000_ALL' }
    ];

    for (const s of sidos) {
        const url = `https://file.localdata.go.kr/file/download/excellent_restaurant_info/info?orgCode=${s.oc}`;
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.localdata.go.kr/'
                }
            });
            console.log(`[${s.name} ${s.oc}] -> HTTP ${res.status}`);
        } catch (e) {
            console.log(`[${s.name} ${s.oc}] -> 실패: ${e.message}`);
        }
    }
}

testOtherSidos();
