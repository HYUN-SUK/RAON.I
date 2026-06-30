import { getAdminCodes } from '../scripts/utils/admin-code-mapping.mjs';
import fetch from 'node-fetch';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const API_KEY = process.env.PUBLIC_DATA_API_KEY;

async function test() {
  // 예시: 인천광역시 중구 (행안부 코드: 28110)
  const { areaCd, signguCd } = getAdminCodes("인천광역시", "중구(인천)");
  console.log(`Resolved Codes -> areaCd: ${areaCd}, signguCd: ${signguCd}`);
  
  if (!areaCd || !signguCd) {
    console.error("Failed to resolve codes");
    return;
  }
  
  const baseYm = '202403'; // Baseline month
  
  // TMAP Associated API 호출 검증
  const tmapUrl = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${API_KEY}&areaCd=${areaCd}&signguCd=${signguCd}&baseYm=${baseYm}&numOfRows=5&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
  console.log(`Probing TMAP API: ${tmapUrl}`);
  
  try {
    const res = await fetch(tmapUrl);
    const data = await res.json();
    const items = data?.response?.body?.items?.item;
    console.log("TMAP API Output items count:", Array.isArray(items) ? items.length : (items ? 1 : 0));
    console.log("Sample Item:", JSON.stringify(items?.[0] || items || {}, null, 2));
  } catch (e) {
    console.error("TMAP API Call failed:", e.message);
  }
}

test();
