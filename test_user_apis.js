const fs = require('fs');

try {
    const envFile = fs.readFileSync('.env.local', 'utf8');
    envFile.split(/\r?\n/).forEach(line => {
        const match = line.match(/^([^#=]+)=(.*)$/);
        if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            if (val.startsWith('"') && val.endsWith('"')) val = val.slice(1, -1);
            if (val.startsWith("'") && val.endsWith("'")) val = val.slice(1, -1);
            process.env[key] = val;
        }
    });
} catch (e) {
    console.warn("Could not load .env.local");
}

const publicApiKey = process.env.PUBLIC_DATA_API_KEY || process.env.KMA_SERVICE_KEY;
const result = {};

async function run() {
    try {
        const specUrl = `https://infuser.odcloud.kr/oas/docs?namespace=15102255/v1`;
        const specRes = await fetch(specUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const spec = await specRes.json();

        const paths = Object.keys(spec.paths || {});
        if (!paths.length) {
            result.baeknyeon = { error: "ODcloud swagger paths empty" };
        } else {
            const latestPath = paths[0];
            const apiUrl = `https://api.odcloud.kr/api${latestPath}?serviceKey=${publicApiKey}&page=1&perPage=5`;
            const res = await fetch(apiUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
            if (res.ok) {
                const data = await res.json();
                result.baeknyeon = { status: "success", count: data.currentCount, latestPath };
            } else {
                result.baeknyeon = { error: `HTTP ${res.status}: ${await res.text()}` };
            }
        }
    } catch (e) {
        result.baeknyeon = { error: e.message };
    }

    try {
        const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const tmFc = `${dateStr}0600`;
        const midTermLandUrl = `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${publicApiKey}&pageNo=1&numOfRows=10&dataType=JSON&regId=11C20000&tmFc=${tmFc}`;

        const res = await fetch(midTermLandUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (res.ok) {
            const data = await res.json();
            const items = data?.response?.body?.items?.item;
            if (items && items.length > 0) {
                result.kma = { status: "success", day3Am: items[0].wf3Am, day3Pm: items[0].wf3Pm };
            } else {
                result.kma = { error: "No data found", header: data?.response?.header };
            }
        } else {
            result.kma = { error: `HTTP ${res.status}` };
        }
    } catch (e) {
        result.kma = { error: e.message };
    }
    fs.writeFileSync('api_test.json', JSON.stringify(result, null, 2), 'utf8');
}

run();
