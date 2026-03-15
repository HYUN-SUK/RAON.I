const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const unzipper = require('unzipper');
const iconv = require('iconv-lite');
const XLSX = require('xlsx');

async function discover() {
    console.log('--- MART CSV HEADER ---');
    try {
        const url = 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip';
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buffer = Buffer.from(await res.arrayBuffer());
        const directory = await unzipper.Open.buffer(buffer);
        const csvFile = directory.files.find(f => f.path.toLowerCase().endsWith('.csv'));
        const rawContent = await csvFile.buffer();
        const content = iconv.decode(rawContent.slice(0, 2000), 'cp949');
        console.log('CSV Header Sample:', content.split('\n')[0]);
    } catch (e) { console.error('Mart error:', e.message); }

    console.log('\n--- GOOD RESTAURANT XLSX HEADER ---');
    try {
        const url = 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx';
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buffer = Buffer.from(await res.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        console.log('XLSX Header Row:', JSON.stringify(rows[0]));
    } catch (e) { console.error('Good error:', e.message); }
}

discover();
