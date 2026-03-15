const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const unzipper = require('unzipper');
const iconv = require('iconv-lite');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

async function auditSourceFile(name, url, isZip = false) {
    console.log(`\n--- AUDITING ${name} ---`);
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buffer = Buffer.from(await res.arrayBuffer());
        let records = [];
        if (isZip) {
            const directory = await unzipper.Open.buffer(buffer);
            const csvFile = directory.files.find(f => f.path.toLowerCase().endsWith('.csv'));
            const content = iconv.decode(await csvFile.buffer(), 'cp949');
            records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
        } else {
            const workbook = XLSX.read(buffer, { type: 'buffer' });
            records = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        }

        console.log(`Total Records: ${records.length}`);
        let coordCount = 0;
        let activeCount = 0;
        for (const r of records) {
            const status = r.상세영업상태명 || r.상세영업상태 || r.영업상태명 || '';
            if (String(status).includes('영업')) {
                activeCount++;
                const keys = Object.keys(r);
                const xKey = keys.find(k => k.includes('좌표') && (k.toLowerCase().includes('x')));
                const yKey = keys.find(k => k.includes('좌표') && (k.toLowerCase().includes('y')));
                let posX = xKey ? r[xKey] : (r.X || r.x || r['좌표정보(X)'] || r['좌표정보(x)']);
                let posY = yKey ? r[yKey] : (r.Y || r.y || r['좌표정보(Y)'] || r['좌표정보(y)']);
                if (posX && posY && !isNaN(parseFloat(posX)) && parseFloat(posX) > 0) coordCount++;
            }
        }
        console.log(`Active (영업): ${activeCount}`);
        console.log(`With Coords: ${coordCount}`);
    } catch (e) {
        console.error(`Error auditing ${name}:`, e.message);
    }
}

(async () => {
    await auditSourceFile('MART', 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip', true);
    await auditSourceFile('GOOD_RESTAURANT', 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx', false);
})();
