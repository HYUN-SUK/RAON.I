import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// Load .env.local
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const publicApiKey = process.env.PUBLIC_DATA_API_KEY;
const opinetKey = process.env.OPINET_API_KEY;
const safeRestKey = process.env.SAFE_RESTAURANT_API_KEY;

const report = { db: {}, api: {} };

async function checkDB() {
    report.db.status = "checking";
    if (!supabaseUrl || !supabaseKey) {
        report.db.error = "Missing credentials";
        return;
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const { data, error } = await supabase.from('smart_plan_facts').select('api_source, created_at, category');

    if (error) {
        report.db.error = error.message;
        return;
    }

    const sourceCounts = {};
    let latestUpdate = null;

    data.forEach(row => {
        sourceCounts[row.api_source] = (sourceCounts[row.api_source] || 0) + 1;
        const d = new Date(row.created_at);
        if (!latestUpdate || d > latestUpdate) latestUpdate = d;
    });

    report.db = {
        totalRecords: data.length,
        latestUpdate: latestUpdate ? latestUpdate.toISOString() : null,
        sources: sourceCounts
    };
}

async function checkAPIs() {
    const tests = [
        { key: "HOSPITAL", url: `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=${encodeURIComponent('충청남도')}&STAGE2=${encodeURIComponent('예산군')}&pageNo=1&numOfRows=1&_type=json` },
        { key: "MART", url: `https://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${publicApiKey}&pageNo=1&numOfRows=1&returnType=json` },
        { key: "RESTAURANT_MOIS", url: `https://apis.data.go.kr/1741000/excellent_restaurant_info/info?serviceKey=${publicApiKey}&pageNo=1&numOfRows=1&returnType=json` },
        { key: "RESTAURANT_SMBA", url: `https://api.odcloud.kr/api/15102255/v1/uddi:fcb174b1-8b01-4964-b814-a70c8967d23e?serviceKey=${publicApiKey}&page=1&perPage=1` },
        { key: "RESTAURANT_SAFE", url: safeRestKey ? `http://211.237.50.150:7080/openapi/${safeRestKey}/json/Grid_20200713000000000605_1/1/1` : null },
        { key: "GAS_STATION", url: opinetKey ? `http://www.opinet.co.kr/api/aroundAll.do?code=${opinetKey}&x=175658&y=341695&radius=10000&sort=1&prodcd=C004&out=json` : null },
        { key: "FESTIVAL_SPOT", url: `http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${publicApiKey}&numOfRows=1&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12&mapX=126.8429&mapY=36.6719&radius=20000` }
    ];

    for (const api of tests) {
        if (!api.url) {
            report.api[api.key] = { status: "skipped", reason: "missing env key" };
            continue;
        }
        try {
            const start = Date.now();
            const res = await fetch(api.url, { headers: { 'User-Agent': 'Mozilla/5.0' }, signal: AbortSignal.timeout(10000) });
            report.api[api.key] = { status: res.ok ? "OK" : \`HTTP \${res.status}\`, timeMs: Date.now() - start };
        } catch (e) {
            report.api[api.key] = { status: "ERROR", error: e.message };
        }
    }
}

async function run() {
    await checkDB();
    await checkAPIs();
    fs.writeFileSync('cron_status.json', JSON.stringify(report, null, 2), 'utf8');
}

run();
