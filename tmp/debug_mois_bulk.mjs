import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_KEY = process.env.PUBLIC_DATA_API_KEY;

async function fetchMoisPage(type, page, rows = 100) {
    let url = '';
    if (type === 'MART') {
        url = `http://localdata.go.kr/openapi/service/rest/Localdata010101/getOpnByGubun01?serviceKey=${PUBLIC_KEY}&pageNo=${page}&numOfRows=${rows}&authKey=A`;
    } else {
        url = `http://localdata.go.kr/openapi/service/rest/Localdata010101/getOpnByGubun03?serviceKey=${PUBLIC_KEY}&pageNo=${page}&numOfRows=${rows}`;
    }

    try {
        const res = await fetch(url);
        const text = await res.text();
        const status = res.status;

        console.log(`      [DEBUG] Page ${page} Raw Body (first 100): ${text.substring(0, 100).replace(/\n/g, '')}`);

        if (text.includes('Unexpected errors')) {
            return { success: false, status, page, reason: 'Unexpected errors (Server Internal)' };
        }
        if (status !== 200) {
            return { success: false, status, page, reason: `HTTP ${status}` };
        }

        // 간단한 JSON 파싱 테스트
        if (text.trim().startsWith('{')) {
            const data = JSON.parse(text);
            const total = data.body?.totalCount || data.response?.body?.totalCount || 0;
            const items = data.body?.items?.item || data.response?.body?.items?.item || [];
            return { success: true, status, page, count: Array.isArray(items) ? items.length : 1, total };
        } else if (text.includes('<?xml')) {
             return { success: true, status, page, format: 'XML' };
        }

        return { success: false, status, page, reason: 'Unknown format or empty' };
    } catch (e) {
        return { success: false, page, reason: e.message };
    }
}

async function debugRange(type, startPage, endPage) {
    console.log(`\n--- Debugging MOIS ${type} Range [${startPage} ~ ${endPage}] ---`);
    for (let p = startPage; p <= endPage; p++) {
        const result = await fetchMoisPage(type, p);
        if (result.success) {
            console.log(`[PASS] Page ${p}: Found ${result.count || result.format} items (Total: ${result.total || '?'})`);
        } else {
            console.error(`[FAIL] Page ${p}: ${result.reason} (Status: ${result.status})`);
        }
        await new Promise(r => setTimeout(r, 500)); // 매너
    }
}

async function run() {
    // 마트(MART) 테스트: 처음 5페이지 + 중간 페이지 + 끝 페이지 추정
    await debugRange('MART', 1, 5);
    await debugRange('MART', 10, 12);
    
    // 모범음식점(REST) 테스트
    await debugRange('REST', 1, 5);
}

run();
