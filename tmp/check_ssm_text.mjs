import fetch from 'node-fetch';

async function checkSSMContent() {
    const url = 'https://www.localdata.go.kr/datafile/each/08_24_01_P_CSV.zip';
    console.log(`Connecting to ${url}...`);
    
    try {
        const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        const text = await res.text();
        console.log(`Size: ${text.length}`);
        console.log(`Content Sample (First 500 chars):`);
        console.log(text.substring(0, 500));
    } catch (e) {
        console.error('FAILED:', e);
    }
}

checkSSMContent();
