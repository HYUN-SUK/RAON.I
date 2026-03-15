const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const XLSX = require('xlsx');

async function diagnostic() {
    console.log('--- GOOD RESTAURANT XLSX DIAGNOSTIC ---');
    try {
        const url = 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx';
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buffer = Buffer.from(await res.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const records = XLSX.utils.sheet_to_json(sheet);
        
        console.log('Total Records Parsed:', records.length);
        const r = records[0];
        console.log('Sample Record:', JSON.stringify(r));
        console.log('Keys:', Object.keys(r));
        
        const name = (r.사업장명 || r.업소명 || r.상호 || r.BPLC_NM || r.bplcNm || '').trim();
        const addr = (r.도로명전체주소 || r.소재지전체주소 || r.RDNWHL_ADDR || r.SITE_WHL_ADDR || '').trim();
        const status = r.상세영업상태 || r.영업상태명 || r.상태명 || r.TRD_STATE_NM || r.trdStateNm || '';
        
        console.log(`Extracted: name=${name}, addr=${addr}, status=${status}`);
        
        const posX = r['좌표정보x(epsg5174)'] || r['좌표정보(x)'] || r['좌표정보(X)'] || r.좌표정보x || r.좌표정보X || r.좌표x || r.좌표X || r.X;
        const posY = r['좌표정보y(epsg5174)'] || r['좌표정보(y)'] || r['좌표정보(Y)'] || r.좌표정보y || r.좌표정보Y || r.좌표y || r.좌표Y || r.Y;
        console.log(`Coords: X=${posX}, Y=${posY}`);
        
        if (!name || !addr) console.log('FAIL: Missing name or addr');
        if (status && !String(status).includes('영업')) console.log('FAIL: Status check failed');
        if (!posX || !posY) console.log('FAIL: Coords missing');
        
    } catch (e) {
        console.error('Diagnostic error:', e);
    }
}

diagnostic();
