import fetch from 'node-fetch';
import dotenv from 'dotenv';
import proj4 from 'proj4';

dotenv.config({ path: '.env.local' });

const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const KAKAO_KEY = process.env.KAKAO_REST_API_KEY;
const OPINET_API_KEY = process.env.OPINET_API_KEY;

// 대상 좌표 (충남 예산군 응봉면 영희네 캠핑장)
const TARGET = {
  name: '영희네',
  lat: 36.626909,
  lng: 126.7647868,
  sido: '충청남도',
  sigungu: '예산군'
};

async function diagnoseHospitals() {
  console.log('\n--- [Diagnosis: HOSPITAL] ---');
  
  // 1. NMC API
  try {
    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${PUBLIC_API_KEY}&STAGE1=${encodeURIComponent(TARGET.sido)}&STAGE2=${encodeURIComponent(TARGET.sigungu)}&pageNo=1&numOfRows=100&_type=json`;
    console.log(`1. NMC API Call: ${url.substring(0, 100)}...`);
    const res = await fetch(url);
    const data = await res.json();
    const items = data.response?.body?.items?.item ? (Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item]) : [];
    console.log(`   - Result: ${items.length} items found.`);
    if (items.length > 0) {
      console.log(`   - Sample: ${items[0].dutyName} (${items[0].dutyAddr})`);
    } else {
      console.warn(`   - Warning: No data returned from NMC for ${TARGET.sido} ${TARGET.sigungu}. Check if parameters are correct for this region.`);
    }
  } catch (e) {
    console.error('   - NMC API Error:', e.message);
  }

  // 2. Kakao HP8 API
  try {
    const url = `https://dapi.kakao.com/v2/local/search/category.json?category_group_code=HP8&x=${TARGET.lng}&y=${TARGET.lat}&radius=20000&size=15`;
    console.log(`2. Kakao Hospital Call: ${url}`);
    const res = await fetch(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_KEY}` } });
    const data = await res.json();
    const docs = data.documents || [];
    console.log(`   - Result: ${docs.length} items found within 20km.`);
    if (docs.length > 0) {
      console.log(`   - Sample: ${docs[0].place_name} (${docs[0].address_name})`);
    }
  } catch (e) {
    console.error('   - Kakao API Error:', e.message);
  }
}

async function diagnoseFestivals() {
  console.log('\n--- [Diagnosis: FESTIVAL] ---');
  try {
    // [TourAPI] locationBasedList2 (contentTypeId=15)
    const url = `http://apis.data.go.kr/B551011/KorService2/locationBasedList2?serviceKey=${PUBLIC_API_KEY}&numOfRows=50&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=15&mapX=${TARGET.lng}&mapY=${TARGET.lat}&radius=20000`;
    console.log(`Festival API Call: ${url.substring(0, 100)}...`);
    const res = await fetch(url);
    const data = await res.json();
    const items = data.response?.body?.items?.item ? (Array.isArray(data.response.body.items.item) ? data.response.body.items.item : [data.response.body.items.item]) : [];
    console.log(`   - Result: ${items.length} items found within 20km.`);
    if (items.length > 0) {
      console.log(`   - Sample: ${items[0].title} (${items[0].addr1})`);
    } else {
      console.log(`   - Info: No current festivals found within 20km of this coordinate.`);
    }
  } catch (e) {
    console.error('   - Festival API Error:', e.message);
  }
}

async function diagnoseGasStations() {
  console.log('\n--- [Diagnosis: GAS_STATION] ---');
  try {
    proj4.defs("TM128", "+proj=tmerc +lat_0=38 +lon_0=128 +k=0.9999 +x_0=400000 +y_0=600000 +ellps=bessel +units=m +no_defs +towgs84=-115.80,474.99,674.11,1.16,-2.31,-1.63,6.43");
    const [wtmX, wtmY] = proj4("EPSG:4326", "TM128", [TARGET.lng, TARGET.lat]);
    
    const url = `http://www.opinet.co.kr/api/aroundAll.do?code=${OPINET_API_KEY}&x=${Math.round(wtmX)}&y=${Math.round(wtmY)}&radius=5000&sort=1&prodcd=C004&out=json`;
    console.log(`Gas Station API Call: ${url}`);
    const res = await fetch(url);
    const data = await res.json();
    const items = data.RESULT?.OIL ? (Array.isArray(data.RESULT.OIL) ? data.RESULT.OIL : [data.RESULT.OIL]) : [];
    console.log(`   - Result: ${items.length} items found within 5km.`);
    if (items.length > 0) {
      console.log(`   - Sample: ${items[0].OS_NM} (Price: ${items[0].PRICE})`);
    } else {
      console.warn(`   - Warning: No gas stations found within 5km of (${TARGET.lng}, ${TARGET.lat}). Raw OPINET Response:`, JSON.stringify(data));
    }
  } catch (e) {
    console.error('   - Gas Station API Error:', e.message);
  }
}

async function run() {
  console.log(`🚀 Starting Diagnosis for ${TARGET.name} (${TARGET.lat}, ${TARGET.lng})`);
  await diagnoseHospitals();
  await diagnoseFestivals();
  await diagnoseGasStations();
  console.log('\n✨ Diagnosis Complete.');
}

run();
