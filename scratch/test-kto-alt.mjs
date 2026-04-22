import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function testKtoAlternative() {
    console.log('🧪 Testing alternative KTO endpoint (TarRlteTarService1)...');
    
    // Tmap based popularity (202504 data)
    // AreaCode 11 (Seoul), Sigungu 11110 (Jongno)
    const params = new URLSearchParams({
        serviceKey: API_KEY,
        numOfRows: '10',
        pageNo: '1',
        MobileOS: 'ETC',
        MobileApp: 'RAONAI',
        _type: 'json',
        baseYm: '202504',
        areaCd: '11',
        signguCd: '11110'
    });

    try {
        const url = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`;
        console.log(`- Requesting: ${url}`);
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.response?.body?.totalCount > 0) {
            console.log(`✅ Success! Found ${data.response.body.totalCount} items.`);
            console.log('--- Sample Ranking ---');
            const items = data.response.body.items.item || [];
            items.forEach((it, idx) => console.log(`[Rank ${idx+1}] ${it.title} (ContentID: ${it.contentId})`));
            return true;
        } else {
            console.log('❌ No data found at this endpoint.');
            return false;
        }
    } catch (e) {
        console.error('❌ Endpoint Error:', e.message);
        return false;
    }
}

testKtoAlternative();
