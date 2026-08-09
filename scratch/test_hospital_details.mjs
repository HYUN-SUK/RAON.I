import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const MOIS_API_KEY = process.env.MOIS_API_KEY || process.env.PUBLIC_DATA_API_KEY;

async function testHospitalDetails(hpid, name) {
    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytBassInfoInqire?serviceKey=${MOIS_API_KEY}&HPID=${hpid}&_type=json`;
    console.log(`\nTesting fetchHospitalDetails for [${hpid}] "${name}"`);
    console.log(`URL: ${url.replace(MOIS_API_KEY, 'SECRET_KEY')}`);

    try {
        const res = await fetch(url, { timeout: 10000 });
        const text = await res.text();
        console.log(`Response status: ${res.status}`);
        console.log(`Response length: ${text.length}`);
        console.log(`Preview:`, text.slice(0, 500));

        try {
            const json = JSON.parse(text);
            const item = json.response?.body?.items?.item;
            console.log(`-> JSON parsed! Item found:`, !!item);
        } catch (je) {
            console.log(`-> JSON parsing FAILED.`);
        }
    } catch (e) {
        console.error(`-> Error:`, e.message);
    }
}

async function run() {
    if (!MOIS_API_KEY) {
        console.error('Missing MOIS_API_KEY');
        return;
    }
    // 울산대학교병원 (울산)
    await testHospitalDetails('A1700004', '울산대학교병원');
    // 세종충남대학교병원 (세종)
    await testHospitalDetails('A1800441', '세종충남대학교병원');
}

run();
