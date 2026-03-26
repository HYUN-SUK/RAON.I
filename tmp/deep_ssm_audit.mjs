import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function deepAudit() {
    console.log('🔍 DEEP AUDIT: MOIS Large Store API (Nationwide)');
    let pageNo = 1;
    const stats = {
        total_meta: 0,
        fetched: 0,
        status: {},
        type: {},
        missing_addr: 0
    };

    while (pageNo < 50) { // Limit to 50 pages to avoid infinite loop
        const url = `http://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${PUBLIC_API_KEY}&pageNo=${pageNo}&numOfRows=100&returnType=JSON`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (!data.response?.body?.items) break;
        
        const items = data.response.body.items.item || [];
        const rawItems = Array.isArray(items) ? items : [items];
        if (rawItems.length === 0) break;

        stats.total_meta = data.response.body.totalCount;
        stats.fetched += rawItems.length;

        for (const i of rawItems) {
            const stNode = i.SALS_STTS_NM || 'UNKNOWN';
            const tyNode = i.STOR_SE_NM || 'UNKNOWN';
            const addr = i.ROAD_NM_ADDR || i.LOTNO_ADDR;

            stats.status[stNode] = (stats.status[stNode] || 0) + 1;
            stats.type[tyNode] = (stats.type[tyNode] || 0) + 1;
            if (!addr) stats.missing_addr++;
        }

        process.stdout.write(`\r- Progress: ${stats.fetched}/${stats.total_meta}...`);
        if (rawItems.length < 100) break;
        pageNo++;
    }

    console.log('\n\n--- 📊 AUDIT RESULTS ---');
    console.log(JSON.stringify(stats, null, 2));
}

deepAudit();
