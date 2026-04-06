
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config({ path: '.env.local' });

const TOUR_API_KEY = process.env.TOUR_API_KEY || process.env.PUBLIC_DATA_API_KEY;

async function testSync() {
  const params = new URLSearchParams({
    serviceKey: TOUR_API_KEY,
    numOfRows: '10',
    pageNo: '1',
    MobileOS: 'ETC',
    MobileApp: 'RAONAI',
    _type: 'json',
    listYN: 'Y',
    arrange: 'A',
    areaCode: '33', // 충청북도
    contentTypeId: '12'
  });

  const url = `https://apis.data.go.kr/B551011/KorService1/areaBasedList1?${params.toString()}`;
  console.log('Testing URL:', url);

  try {
    const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
    const text = await res.text();
    console.log('Response (first 500 chars):', text.substring(0, 500));
    const data = JSON.parse(text);
    console.log('Items Count:', data.response?.body?.items?.item?.length || 0);
  } catch (e) {
    console.error('Error:', e.message);
  }
}

testSync();
