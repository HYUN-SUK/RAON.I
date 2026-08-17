import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const key = process.env.PUBLIC_DATA_API_KEY;

async function testTmapGwangju() {
    console.log('--- 광주/전남 TMAP API 파라미터 테스트 ---');
    // 북구(광주): areaCd=29, signguCd=29170
    // 목포시: areaCd=46, signguCd=46110
    const tests = [
        { name: '북구(광주)', areaCd: '29', signguCd: '29170' },
        { name: '목포시', areaCd: '46', signguCd: '46110' },
        { name: '여수시', areaCd: '46', signguCd: '46130' }
    ];

    for (const t of tests) {
        for (const ym of ['202606', '202504', '202412']) {
            const url = `https://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${key}&areaCd=${t.areaCd}&signguCd=${t.signguCd}&baseYm=${ym}&numOfRows=5&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
            const res = await fetch(url);
            const data = await res.json();
            const count = data?.response?.body?.totalCount || 0;
            console.log(`[${t.name} ${ym}] totalCount: ${count}`);
        }
    }
}

testTmapGwangju();
