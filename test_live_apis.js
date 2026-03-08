const fs = require('fs');

const envStr = fs.readFileSync('.env.local', 'utf8');
const env = {};
envStr.split(/\r?\n/).forEach(line => {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) env[match[1]] = match[2];
});

const pubKey = env['PUBLIC_DATA_API_KEY']?.trim();
const opinetKey = env['OPINET_API_KEY']?.trim();
const safeKey = env['SAFE_RESTAURANT_API_KEY']?.trim();

const targets = [
    { name: 'NMC_HOSPITAL', url: `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${pubKey}&STAGE1=${encodeURIComponent('충청남도')}&STAGE2=${encodeURIComponent('예산군')}&pageNo=1&numOfRows=10&_type=json` },
    { name: 'LARGE_STORE', url: `https://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${pubKey}&pageNo=1&numOfRows=10&returnType=json` },
    { name: 'SMBA_BAEK', url: `https://api.odcloud.kr/api/15102255/v1/uddi:bbcca44f-f3f8-4b77-a8bd-5645db9c47ca?serviceKey=${pubKey}&page=1&perPage=10` },
    { name: 'SAFE_RESTAURANT', url: `http://211.237.50.150:7080/openapi/${safeKey}/json/Grid_20200713000000000605_1/1/10` },
    { name: 'OPINET', url: `http://www.opinet.co.kr/api/aroundAll.do?code=${opinetKey}&x=175658&y=341695&radius=10000&sort=1&prodcd=C004&out=json` },
    { name: 'TOUR_API', url: `http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${pubKey}&numOfRows=10&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=126.9780&mapY=37.5665&radius=20000` }
];

async function run() {
    for (const target of targets) {
        try {
            const start = Date.now();
            const res = await fetch(target.url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            const data = await res.text();
            const time = Date.now() - start;
            const valid = data.includes('{') || data.includes('<');
            console.log(`[${target.name}]: HTTP ${res.status} | Data Valid: ${valid} | ${time}ms`);
        } catch (e) {
            console.log(`[${target.name}]: ERROR - ${e.message}`);
        }
    }
}

run();
