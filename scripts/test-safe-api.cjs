
const fetch = require('node-fetch');
require('dotenv').config({ path: '.env.local' });

async function checkFields() {
    const key = process.env.SAFE_RESTAURANT_API_KEY;
    const url = `http://211.237.50.150:7080/openapi/${key}/json/Grid_20200713000000000605_1/1/1`;
    try {
        const res = await fetch(url);
        const data = await res.json();
        const row = data.Grid_20200713000000000605_1.row[0];
        console.log('--- Full Record Sample ---');
        console.log(JSON.stringify(row, null, 2));
    } catch (e) {
        console.error('Error:', e.message);
    }
}
checkFields();
