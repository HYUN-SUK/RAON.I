import fetch from 'node-fetch';
import unzipper from 'unzipper';
import iconv from 'iconv-lite';
import { parse } from 'csv-parse/sync';
import fs from 'fs';

const SOURCES = [
    { name: '대규모마트 (LARGE)', url: 'https://www.localdata.go.kr/datafile/each/08_25_01_P_CSV.zip' },
    { name: '중형슈퍼 (SUPER)', url: 'https://www.localdata.go.kr/datafile/each/07_22_13_P_CSV.zip' }
];

async function deepAudit() {
    console.log('--- 📊 DEEP RAW DATA AUDIT ---');
    
    for (const source of SOURCES) {
        console.log(`\n[Checking] ${source.name}...`);
        try {
            const res = await fetch(source.url, { 
                headers: { 
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebkit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                    'Referer': 'https://www.localdata.go.kr/devcenter/dataDown.do?menuNo=20001'
                } 
            });
            
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            const buffer = Buffer.from(await res.arrayBuffer());
            const directory = await unzipper.Open.buffer(buffer);
            
            console.log(`  ZIP contains ${directory.files.length} files.`);
            let totalInZip = 0;
            let totalActive = 0;

            for (const f of directory.files) {
                console.log(`  - Processing ${f.path}...`);
                if (f.path.toLowerCase().endsWith('.csv')) {
                    const buf = await f.buffer();
                    const content = iconv.decode(buf, 'cp949');
                    const parsed = parse(content, { columns: true, skip_empty_lines: true, relax_column_count: true });
                    
                    const activeBatch = parsed.filter(r => {
                        const status = r.상세영업상태명 || r.상태명 || r.영업상태명 || '';
                        return status.includes('영업');
                    });
                    
                    console.log(`    Parsed ${parsed.length} rows, ${activeBatch.length} are active.`);
                    totalInZip += parsed.length;
                    totalActive += activeBatch.length;
                }
            }
            console.log(`  [RESULT] ${source.name}: Total=${totalInZip}, Active=${totalActive}`);
        } catch (e) {
            console.error(`  [ERROR] ${source.name} failed:`, e.message);
        }
    }
}

deepAudit();
