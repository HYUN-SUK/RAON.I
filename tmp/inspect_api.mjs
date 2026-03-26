import fetch from 'node-fetch';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function inspectAPI() {
    const url = `http://apis.data.go.kr/1741000/large_scale_retail_stores/info?serviceKey=${PUBLIC_API_KEY}&pageNo=1&numOfRows=10&returnType=JSON`;
    console.log(`Fetching ${url}...`);
    
    try {
        const res = await fetch(url);
        const data = await res.json();
        fs.writeFileSync('c:\\Users\\USER\\Desktop\\RAON.I\\tmp\\api_inspect.json', JSON.stringify(data, null, 2), 'utf8');
        console.log('Saved to tmp/api_inspect.json');
    } catch (e) {
        console.error('FAILED:', e);
    }
}

inspectAPI();
