const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const unzipper = require('unzipper');
const iconv = require('iconv-lite');
const { parse } = require('csv-parse/sync');
const XLSX = require('xlsx');

async function discoverKeys() {
    console.log('--- MART CSV KEY DISCOVERY ---');
    try {
        const url = 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip';
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buffer = Buffer.from(await res.arrayBuffer());
        const directory = await unzipper.Open.buffer(buffer);
        const csvFile = directory.files.find(f => f.path.toLowerCase().endsWith('.csv'));
        const content = iconv.decode(await csvFile.buffer(), 'cp949');
        const records = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true, to: 1 });
        const keys = Object.keys(records[0]);
        console.log('Mart Keys (Raw):', JSON.stringify(keys));
        console.log('Marts with coordinate-like keys:', keys.filter(k => k.toLowerCase().includes('좌표') || k.toLowerCase().includes('x') || k.toLowerCase().includes('y') || k.toLowerCase().includes('epsg')));
    } catch (e) { console.error('Mart error:', e.message); }

    console.log('\n--- GOOD RESTAURANT XLSX KEY DISCOVERY ---');
    try {
        const url = 'https://www.localdata.go.kr/datafile/etc/LOCALDATA_ALL_12_03_01_E.xlsx';
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const buffer = Buffer.from(await res.arrayBuffer());
        const workbook = XLSX.read(buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const records = XLSX.utils.sheet_to_json(sheet, { range: 0 }); // range 0 to get header row
        const keys = Object.keys(records[0]);
        console.log('Good Restaurant Keys (Raw):', JSON.stringify(keys));
        console.log('Good with coordinate-like keys:', keys.filter(k => k.toLowerCase().includes('좌표') || k.toLowerCase().includes('x') || k.toLowerCase().includes('y')));
    } catch (e) { console.error('Good error:', e.message); }
}

discoverKeys();
