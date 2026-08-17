import iconv from 'iconv-lite';

async function test613Decoded() {
    const url = `https://file.localdata.go.kr/file/download/excellent_restaurant_info/info?orgCode=6130000_ALL`;
    const res = await fetch(url, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Referer': 'https://www.localdata.go.kr/'
        }
    });
    const buffer = await res.arrayBuffer();
    const text = iconv.decode(Buffer.from(buffer), 'EUC-KR');
    console.log('[6130000_ALL 한글 내용 첫 5줄]:');
    const lines = text.split('\n');
    for (let i = 0; i < 5; i++) {
        console.log(lines[i]);
    }
}

test613Decoded();
