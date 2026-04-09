import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SAFE_API_KEY = process.env.SAFE_API_KEY || process.env.PUBLIC_DATA_API_KEY;

async function testSafe() {
  const shortSido = '전남';
  const fullSido = '전라남도';
  let params = new URLSearchParams({ RELAX_SI_NM: shortSido });
  let url = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/10?${params.toString()}`;
  
  console.log(`Testing short sido (${shortSido}): ${url}`);
  try {
    let res = await fetch(url);
    let data = await res.json();
    console.log('Short Sido Items:', data.Grid_20200713000000000605_1?.row?.length || 0);
  } catch(e) { console.error('Error short:', e); }

  params = new URLSearchParams({ RELAX_SI_NM: fullSido });
  url = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/10?${params.toString()}`;
  console.log(`\nTesting full sido (${fullSido}): ${url}`);
  try {
    let res = await fetch(url);
    let data = await res.json();
    console.log('Full Sido Items:', data.Grid_20200713000000000605_1?.row?.length || 0);
  } catch(e) { console.error('Error full:', e); }

  console.log('\nTesting no region param limit 10:');
  url = `http://211.237.50.150:7080/openapi/${SAFE_API_KEY}/json/Grid_20200713000000000605_1/1/10`;
  try {
    let res = await fetch(url);
    let data = await res.json();
    console.log('No param Items:', data.Grid_20200713000000000605_1?.row?.map(r => r.RELAX_SI_NM));
  } catch(e) { console.error('Error no param:', e); }
}

testSafe();
