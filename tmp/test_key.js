import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const key = process.env.SAFE_API_KEY || process.env.PUBLIC_DATA_API_KEY;

async function run() {
  console.log('Original key contains %?', key.includes('%'));
  console.log('Original key contains +?', key.includes('+'));
  console.log('Original key contains /?', key.includes('/'));
  
  const decoded = decodeURIComponent(key);
  const encoded = encodeURIComponent(decoded);

  console.log('Decoded same as original?', decoded === key);
  console.log('Encoded same as original?', encoded === key);

  // let's test MAFRA API with decoded key
  try {
    let url = `http://211.237.50.150:7080/openapi/${decoded}/json/Grid_20200713000000000605_1/1/1`;
    let res = await fetch(url);
    let data = await res.json();
    console.log('Result with DECODED key:', data.Grid_20200713000000000605_1?.row ? 'SUCCESS' : data);
  } catch (e) {
    console.log('DECODED error', e.message);
  }

  // let's test MAFRA API with encoded key
  try {
    let url = `http://211.237.50.150:7080/openapi/${encoded}/json/Grid_20200713000000000605_1/1/1`;
    let res = await fetch(url);
    let data = await res.json();
    console.log('Result with ENCODED key:', data.Grid_20200713000000000605_1?.row ? 'SUCCESS' : data);
  } catch (e) {
    console.log('ENCODED error', e.message);
  }
}
run();
