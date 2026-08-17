async function test613Marts() {
    const endpoints = ['large_scale_retail_stores', 'other_food_retailers', 'excellent_restaurant_info'];
    for (const ep of endpoints) {
        const url = `https://file.localdata.go.kr/file/download/${ep}/info?orgCode=6130000_ALL`;
        const res = await fetch(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': 'https://www.localdata.go.kr/'
            }
        });
        console.log(`[6130000_ALL ${ep}] -> HTTP ${res.status} | Size: ${res.headers.get('content-length')}`);
    }
}

test613Marts();
