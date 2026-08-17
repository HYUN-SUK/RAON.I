async function testNewOrgCodes() {
    console.log('--- 6500000 ~ 6600000 orgCode 스캔 ---');
    for (let i = 650; i <= 660; i++) {
        const oc = `${i}0000_ALL`;
        const url = `https://file.localdata.go.kr/file/download/excellent_restaurant_info/info?orgCode=${oc}`;
        try {
            const res = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.localdata.go.kr/'
                }
            });
            if (res.status === 200) {
                console.log(`✨ [발견!!] orgCode: ${oc} -> HTTP 200`);
            } else {
                // console.log(`[${oc}] -> HTTP ${res.status}`);
            }
        } catch (e) {
            // ignore
        }
    }
}

testNewOrgCodes();
