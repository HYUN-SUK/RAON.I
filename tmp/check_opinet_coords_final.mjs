import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const OPINET_KEY = process.env.OPINET_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;

async function testOpinet(label, x, y, prodcd = 'C004') {
  const url = `http://www.opinet.co.kr/api/aroundAll.do?out=json&code=${OPINET_KEY}&x=${x}&y=${y}&radius=5000&prodcd=${prodcd}`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    console.log(`[${label}] [${prodcd}] x=${x}, y=${y} -> Count: ${data.RESULT?.OIL?.length || 0}`);
    if (data.RESULT?.OIL?.length > 0) {
      console.log(`   Sample: ${data.RESULT.OIL[0].OS_NM}`);
    }
  } catch (e) {
    console.log(`[${label}] [${prodcd}] Error: ${e.message}`);
  }
}

async function getCoords(lon, lat, output) {
  const url = `https://dapi.kakao.com/v2/local/geo/transcoord.json?x=${lon}&y=${lat}&input_coord=WGS84&output_coord=${output}`;
  const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
  return await res.json();
}

async function run() {
  const lon = 127.0276197; // 강남역
  const lat = 37.497942;
  
  console.log('--- Coordinate & Product Test for Opinet ---');
  
  // 1. WTM - Kerosene & Gasoline
  const wtm = await getCoords(lon, lat, 'WTM');
  if (wtm.documents?.[0]) {
    const wx = Math.round(wtm.documents[0].x);
    const wy = Math.round(wtm.documents[0].y);
    await testOpinet('WTM', wx, wy, 'C004'); // 등유
    await testOpinet('WTM', wx, wy, 'B027'); // 휘발유
  }

  // 2. TM - Kerosene & Gasoline
  const tm = await getCoords(lon, lat, 'TM');
  if (tm.documents?.[0]) {
    const tx = Math.round(tm.documents[0].x);
    const ty = Math.round(tm.documents[0].y);
    await testOpinet('TM', tx, ty, 'C004'); 
    await testOpinet('TM', tx, ty, 'B027');
  }

  // 3. Manual V3-1 Coordinates - Gasoline
  await testOpinet('V3-1 Manual', 175658, 341695, 'B027');
}

run();
