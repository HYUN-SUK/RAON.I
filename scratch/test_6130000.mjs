async function test613() {
    const url = `https://file.localdata.go.kr/file/download/excellent_restaurant_info/info?orgCode=6130000_ALL`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.localdata.go.kr/'
        }
    });
    const text = await res.text();
    console.log('[6130000_ALL 내용 첫 500자]:');
    console.log(text.slice(0, 500));
}

test613();
