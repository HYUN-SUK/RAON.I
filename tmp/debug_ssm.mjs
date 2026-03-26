import fetch from 'node-fetch';
import unzipper from 'unzipper';
import iconv from 'iconv-lite';

async function debugSSM() {
    const url = 'https://www.localdata.go.kr/datafile/each/08_24_01_P_CSV.zip';
    console.log(`Connecting to ${url}...`);
    
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        
        const buffer = Buffer.from(await res.arrayBuffer());
        console.log(`Downloaded ${buffer.length} bytes.`);
        
        const directory = await unzipper.Open.buffer(buffer);
        console.log(`ZIP has ${directory.files.length} files.`);
        
        const csvFiles = directory.files.filter(f => f.path.toLowerCase().endsWith('.csv'));
        console.log(`Found ${csvFiles.length} CSV files:`);
        
        for (const f of csvFiles) {
            console.log(` - ${f.path} (${f.uncompressedSize} bytes)`);
            const buf = await f.buffer();
            const content = iconv.decode(buf, 'cp949');
            const lines = content.split('\n');
            console.log(`   Sample lines: ${lines.length}`);
            console.log(`   First line: ${lines[0].substring(0, 100)}`);
        }
    } catch (e) {
        console.error('DEBUG FAILED:', e);
    }
}

debugSSM();
