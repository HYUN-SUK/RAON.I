import fetch from 'node-fetch';

async function testWithReferer() {
    const url = 'https://www.localdata.go.kr/datafile/each/08_24_01_P_CSV.zip';
    const referer = 'https://www.localdata.go.kr/devcenter/dataDown.do?menuNo=20001';
    
    console.log(`Connecting to ${url} with Referer...`);
    
    try {
        const res = await fetch(url, { 
            headers: { 
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Referer': referer
            } 
        });
        
        const buffer = Buffer.from(await res.arrayBuffer());
        console.log(`Size: ${buffer.length} bytes`);
        if (buffer.length < 1000) {
            console.log(`Content Sample: ${buffer.toString('utf8').substring(0, 100)}`);
        } else {
            console.log(`Success? First 4 bytes: ${buffer.slice(0, 4).toString('hex')} (PK is 504b0304)`);
        }
    } catch (e) {
        console.error('FAILED:', e);
    }
}

testWithReferer();
