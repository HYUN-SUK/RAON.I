import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function diagnoseCodes() {
    console.log('🧪 Diagnosing KTO Area Codes for Suncheon (Jeonnam)...');
    
    const cases = [
        { label: 'Legal Code (46/46150)', area: '46', sigungu: '46150' },
        { label: 'KTO Legacy (38/2)', area: '38', sigungu: '2' },
        { label: 'Mixed 1 (46/150)', area: '46', sigungu: '150' },
        { label: 'Mixed 2 (38/46150)', area: '38', sigungu: '46150' }
    ];

    for (const c of cases) {
        const params = new URLSearchParams({
            serviceKey: API_KEY, numOfRows: '1', pageNo: '1',
            MobileOS: 'ETC', MobileApp: 'RAONAI', _type: 'json',
            baseYm: '202504', areaCd: c.area, signguCd: c.sigungu
        });
        
        try {
            const url = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?${params.toString()}`;
            const res = await fetch(url);
            const data = await res.json();
            const count = data.response?.body?.totalCount || 0;
            console.log(`- ${c.label}: ${count > 0 ? '✅ SUCCESS' : '❌ FAILED'} (${count} items)`);
        } catch (e) {
            console.log(`- ${c.label}: ❌ ERROR (${e.message})`);
        }
    }
}

diagnoseCodes();
