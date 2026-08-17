async function scanAllValidOrgCodes() {
    console.log('--- 전국 유효한 orgCode 전체 탐색 ---');
    const valid = [];
    for (let i = 500; i <= 660; i++) {
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
                valid.push(oc);
            }
        } catch (e) {}
    }
    console.log('현재 행안부 LocalData에서 200 응답을 주는 전체 orgCode:');
    console.log(valid);
}

scanAllValidOrgCodes();
