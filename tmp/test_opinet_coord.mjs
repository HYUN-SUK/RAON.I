import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const OPINET_KEY = process.env.OPINET_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

async function testOpinetWithCoord(name, x_coord, y_coord) {
  console.log(`\n--- Testing Opinet aroundAll.do for ${name} ---`);
  console.log(`Coords: x=${x_coord}, y=${y_coord}`);
  
  const url = `http://www.opinet.co.kr/api/aroundAll.do?out=json&code=${OPINET_KEY}&x=${x_coord}&y=${y_coord}&radius=5000&prodcd=C004`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`Result Count: ${data.RESULT?.OIL?.length || 0}`);
    if (data.RESULT?.OIL?.length > 0) {
      console.log('Sample Item:', data.RESULT.OIL[0]);
    } else {
      console.log('Full Response:', JSON.stringify(data));
    }
  } catch (err) {
    console.error('Error:', err.message);
  }
}

async function getTransCoord(lon, lat, output) {
  const url = `https://dapi.kakao.com/v2/local/geo/transcoord.json?x=${lon}&y=${lat}&input_coord=WGS84&output_coord=${output}`;
  const res = await fetch(url, {
    headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` }
  });
  const data = await res.json();
  return data.documents?.[0];
}

async function run() {
  const seoulVibe = { lon: 127.0276197, lat: 37.497942 }; // Gangnam Station
  
  // Test TM
  const tm = await getTransCoord(seoulVibe.lon, seoulVibe.lat, 'TM');
  if (tm) await testOpinetWithCoord('Gangnam (TM)', Math.round(tm.x), Math.round(tm.y));

  // Test WTM
  const wtm = await getTransCoord(seoulVibe.lon, seoulVibe.lat, 'WTM');
  if (wtm) await testOpinetWithCoord('Gangnam (WTM)', Math.round(wtm.x), Math.round(wtm.y));

  // Test KATECH (WGS84 -> KATECH conversion is usually what Opinet wants)
  // Kakao doesn't directly support KATECH in transcoord, but WTM is often used interchangeably in some contexts or KATECH is a minor variation.
  // Let's try WGS84 just in case
  await testOpinetWithCoord('Gangnam (WGS84)', seoulVibe.lon, seoulVibe.lat);
}

run();
