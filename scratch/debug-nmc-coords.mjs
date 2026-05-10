
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

async function debugHospitalDetails() {
    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&STAGE1=${encodeURIComponent('세종')}&STAGE2=&pageNo=1&numOfRows=10&_type=json`;
    const res = await fetch(url);
    const data = await res.json();
    const items = data.response?.body?.items?.item;
    const list = Array.isArray(items) ? items : [items];
    
    console.log('--- NMC Hospital Details ---');
    list.forEach(it => {
        console.log(`- ${it.dutyName}`);
        console.log(`  Addr: ${it.dutyAddr}`);
        console.log(`  Coords: ${it.wgs84Lat}, ${it.wgs84Lon}`);
    });
}

debugHospitalDetails();
