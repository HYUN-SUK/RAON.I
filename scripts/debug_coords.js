const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const unzipper = require('unzipper');
const iconv = require('iconv-lite');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

async function debugMarts() {
    console.log('--- DEBUGGING MARTS ---');
    const url = 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const buffer = Buffer.from(await res.arrayBuffer());
    const directory = await unzipper.Open.buffer(buffer);
    const csvFile = directory.files.find(f => f.path.toLowerCase().endsWith('.csv'));
    const content = iconv.decode(await csvFile.buffer(), 'cp949');
    const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
    
    const r = records[0];
    console.log('Keys:', Object.keys(r));
    const posX = r['좌표정보x(epsg5174)'] || r['좌표정보(x)'] || r['좌표정보(X)'] || r.좌표정보x || r.좌표정보X || r.좌표x || r.좌표X || r.X;
    const posY = r['좌표정보y(epsg5174)'] || r['좌표정보(y)'] || r['좌표정보(Y)'] || r.좌표정보y || r.좌표정보Y || r.좌표y || r.좌표Y || r.Y;
    console.log(`Sample Coords: X=${posX}, Y=${posY}`);
}

async function debugGood() {
    console.log('\n--- DEBUGGING GOOD RESTAURANTS ---');
    const url = 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx';
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const buffer = Buffer.from(await res.arrayBuffer());
    const workbook = XLSX.read(buffer, { type: 'buffer' });
    const records = XLSX.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
    
    const r = records[0];
    console.log('Keys:', Object.keys(r));
    const posX = r['좌표정보x(epsg5174)'] || r['좌표정보(x)'] || r['좌표정보(X)'] || r.좌표정보x || r.좌표정보X || r.좌표x || r.좌표X || r.X;
    const posY = r['좌표정보y(epsg5174)'] || r['좌표정보(y)'] || r['좌표정보(Y)'] || r.좌표정보y || r.좌표정보Y || r.좌표y || r.좌표Y || r.Y;
    console.log(`Sample Coords: X=${posX}, Y=${posY}`);
}

(async () => {
    await debugMarts();
    await debugGood();
})();
