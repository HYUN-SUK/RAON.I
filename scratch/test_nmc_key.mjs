import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const rawKey = process.env.MOIS_API_KEY;
const decodedKey = decodeURIComponent(rawKey);

async function testKey() {
    console.log('--- NMC 서비스키 디코딩 테스트 ---');
    console.log('Raw Key 길이:', rawKey?.length);
    console.log('Decoded Key 길이:', decodedKey?.length);

    // 1. Raw Key
    const url1 = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${rawKey}&STAGE1=${encodeURIComponent('광주광역시')}&STAGE2=&pageNo=1&numOfRows=5&_type=json`;
    const res1 = await fetch(url1);
    console.log('1. Raw Key 결과:', (await res1.text()).slice(0, 200));

    // 2. Decoded Key
    const url2 = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${encodeURIComponent(decodedKey)}&STAGE1=${encodeURIComponent('광주광역시')}&STAGE2=&pageNo=1&numOfRows=5&_type=json`;
    const res2 = await fetch(url2);
    console.log('2. Decoded Key (인코딩 전송) 결과:', (await res2.text()).slice(0, 200));

    // 3. Decoded Key 원본 전송
    const url3 = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${decodedKey}&STAGE1=${encodeURIComponent('광주광역시')}&STAGE2=&pageNo=1&numOfRows=5&_type=json`;
    const res3 = await fetch(url3);
    console.log('3. Decoded Key (원본 전송) 결과:', (await res3.text()).slice(0, 200));
}

testKey();
