import fetch from 'node-fetch';
import unzipper from 'unzipper';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

const SOURCES = [
    { name: '대규모마트 (LARGE)', url: 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip', id: 'MART_LARGE' },
    { name: '준대규모마트 (SSM)', url: 'https://www.localdata.go.kr/datafile/each/08_24_01_P_CSV.zip', id: 'MART_SSM' },
    { name: '중형슈퍼 (SUPER)', url: 'https://www.localdata.go.kr/datafile/each/07_22_13_P_CSV.zip', id: 'MART_SUPER' }
];

async function countRawData() {
    console.log('--- 📊 RAW DATA AUDIT START ---');
    let report = '--- 🛒 MART RAW DATA COUNT REPORT ---\n';
    
    for (const source of SOURCES) {
        console.log(`\n[Checking] ${source.name}...`);
        try {
            const res = await fetch(source.url, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.localdata.go.kr/devcenter/dataDown.do?menuNo=20001'
                } 
            });
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = Buffer.from(await res.arrayBuffer());
            
            if (buffer.length < 2000) {
                 // Check if it's maintenance HTML
                 const content = buffer.toString('utf8');
                 if (content.includes('점점')) {
                     console.log(`  [!] ${source.name} is under maintenance (HTML received).`);
                     report += `${source.name}: 점검 중 (다운로드 불가)\n`;
                     continue;
                 }
            }

            const directory = await unzipper.Open.buffer(buffer);
            const csvFiles = directory.files.filter(f => f.path.toLowerCase().endsWith('.csv'));
            
            let totalRecords = 0;
            for (const f of csvFiles) {
                const buf = await f.buffer();
                const content = iconv.decode(buf, 'cp949');
                const parsed = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
                // Filter only '영업/정상영업' status to match sync logic
                const validRecords = parsed.filter(r => {
                    const status = r.상세영업상태명 || r.상태명 || r.영업상태명 || '';
                    return status.includes('영업');
                });
                totalRecords += validRecords.length;
                console.log(`  - File ${f.path}: Found ${validRecords.length} active records (out of ${parsed.length}).`);
            }
            
            report += `${source.name}: ${totalRecords.toLocaleString()} 건 (원천 기준)\n`;
            console.log(`  [OK] Total active records: ${totalRecords}`);
            
        } catch (e) {
            console.error(`  [ERROR] ${source.name} failed:`, e.message);
            report += `${source.name}: 오류 (${e.message})\n`;
        }
    }
    
    fs.writeFileSync('c:\\Users\\USER\\Desktop\\RAON.I\\tmp\\raw_mart_report.txt', report, 'utf8');
    console.log('\nFinal Report saved to tmp/raw_mart_report.txt');
}

countRawData();
