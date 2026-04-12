import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { ADMIN_SIDO_MAP, SIGUNGU_CODE_OVERRIDES, getAdminCodes } from '../scripts/utils/admin-code-mapping.mjs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Mocking the helper functions from daily-region-sync.mjs for verification
function getCleanString(str) {
  if (!str) return '';
  return String(str).replace(/\(.+?\)/g, '').replace(/\s+/g, '').toLowerCase();
}

async function fetchWithRetry(url, options = {}, maxRetries = 2) {
  const res = await fetch(url, options);
  return await res.json();
}

async function findLatestBaseYm() {
    return '202504'; // Already verified
}

async function simulateUpdate(targetSido) {
    console.log(`\n--- Simulating Popularity Update for ${targetSido} ---`);
    const { areaCd } = getAdminCodes(targetSido);
    const baseYm = await findLatestBaseYm();
    
    // Test with Seogwipo (50130)
    const signguCd = '50130';
    
    console.log(`Target: ${targetSido} (${areaCd}), Sigungu: 서귀포시 (${signguCd}), BaseYm: ${baseYm}`);

    // (A) Fetch Tmap
    const tmapUrl = `http://apis.data.go.kr/B551011/TarRlteTarService1/areaBasedList1?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=${areaCd}&signguCd=${signguCd}&baseYm=${baseYm}&numOfRows=50&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
    const tmapData = await fetchWithRetry(tmapUrl);
    const tmapList = tmapData?.response?.body?.items?.item || [];

    // (B) Fetch KT
    const ktUrl = `http://apis.data.go.kr/B551011/TatsCnctrRateService/tatsCnctrRatedList?serviceKey=${process.env.PUBLIC_DATA_API_KEY}&areaCd=${areaCd}&signguCd=${signguCd}&numOfRows=50&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
    const ktData = await fetchWithRetry(ktUrl);
    const ktList = ktData?.response?.body?.items?.item || [];

    console.log(`Received Tmap: ${tmapList.length}, KT: ${ktList.length}`);

    if (tmapList.length > 0) {
        console.log('Sample Tmap Item:', tmapList[0].tAtsNm, '->', tmapList[0].rlteTatsNm);
    }
    if (ktList.length > 0) {
        console.log('Sample KT Item:', ktList[0].tAtsNm, 'Concentration:', ktList[0].cnctrRate);
    }
}

simulateUpdate('제주특별자치도');
