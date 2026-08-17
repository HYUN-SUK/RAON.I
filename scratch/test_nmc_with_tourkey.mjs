import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function testKeys() {
    const keys = [
        { name: 'PUBLIC_DATA_API_KEY', key: process.env.PUBLIC_DATA_API_KEY },
        { name: 'TOUR_API_KEY', key: process.env.TOUR_API_KEY },
        { name: 'KMA_SERVICE_KEY', key: process.env.KMA_SERVICE_KEY }
    ];

    for (const k of keys) {
        const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${k.key}&STAGE1=${encodeURIComponent('광주광역시')}&STAGE2=&pageNo=1&numOfRows=5&_type=json`;
        const res = await fetch(url);
        const text = await res.text();
        console.log(`[${k.name}] -> status: ${res.status} | text: ${text.slice(0, 150)}`);
    }
}

testKeys();
