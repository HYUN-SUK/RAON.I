import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
import { v5 as uuidv5 } from 'uuid';
import proj4 from 'proj4';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const MOIS_API_KEY = process.env.MOIS_API_KEY || process.env.PUBLIC_DATA_API_KEY;
const KAKAO_API_KEY = process.env.KAKAO_REST_API_KEY;
const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const SIDO_ALIASES = {
  '울산': ['울산광역시', '울산'],
  '세종': ['세종특별자치시', '세종']
};

const SIDO_SHORT_MAP = {
  '울산광역시': '울산',
  '세종특별자치시': '세종'
};

const delay = (ms) => new Promise(res => setTimeout(res, ms));

function getCleanString(str) {
  if (!str) return '';
  return str.replace(/\s+/g, ' ').trim();
}

function getNormalizedAddr(addr) {
  if (!addr) return '';
  return addr.replace(/,\s?대한민국$/, '').trim();
}

const generateId = (source, name, addr) => {
  const normalizedAddr = getNormalizedAddr(addr);
  const cleanName = getCleanString(name);
  const cleanAddr = getCleanString(normalizedAddr);
  return uuidv5(`${source}|${cleanName}|${cleanAddr}`, MY_NAMESPACE);
};

async function fetchWithRetry(url, options = {}, maxRetries = 3) {
  let attempt = 0;
  while (attempt <= maxRetries) {
    try {
      const mergedOptions = {
        ...options,
        headers: {
          'User-Agent': 'Mozilla/5.0',
          ...(options.headers || {})
        }
      };
      const res = await fetch(url, mergedOptions);
      if (!res.ok) {
        if (res.status === 500) throw new Error(`HTTP 500 (Server Error)`);
        if (attempt === maxRetries) return res;
      }
      const text = await res.text();
      try {
        const json = JSON.parse(text);
        return json;
      } catch (parseError) {
        throw new Error(`JSON Parse Error: ${parseError.message}`);
      }
    } catch (e) {
      attempt++;
      if (attempt > maxRetries) throw e;
      await delay(500);
    }
  }
}

async function fetchHospitalDetails(hpid, apiKey) {
  const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEgytBassInfoInqire?serviceKey=${apiKey}&HPID=${hpid}&_type=json`;
  const data = await fetchWithRetry(url);
  const itemObj = data?.response?.body?.items?.item;
  return itemObj ? (Array.isArray(itemObj) ? itemObj[0] : itemObj) : null;
}

async function getKakaoCoordinates(addr) {
  if (!KAKAO_API_KEY) return { lat: 0, lng: 0 };
  try {
    const url = `https://dapi.kakao.com/v2/local/search/address.json?query=${encodeURIComponent(addr)}`;
    const data = await fetchWithRetry(url, { headers: { 'Authorization': `KakaoAK ${KAKAO_API_KEY}` } }, 1);
    if (data?.documents?.[0]) {
      return {
        lat: parseFloat(data.documents[0].y),
        lng: parseFloat(data.documents[0].x)
      };
    }
  } catch (e) {
    console.warn(`    ⚠️ Kakao Geocoding Failed for: ${addr}`);
  }
  return { lat: 0, lng: 0 };
}

async function syncHospitalsTest(sido) {
  console.log(`🏥 [NMC TEST] ${sido} 병원 동기화 테스트 시작...`);
  const shortSido = SIDO_SHORT_MAP[sido] || sido;
  const aliases = SIDO_ALIASES[shortSido] || [shortSido];
  const stat = { fetched: { active: 0 }, note: '' };
  const seenIds = new Set();

  try {
    const { data: existingHospitals, error: selectErr } = await supabase
      .from('master_places')
      .select('id, lat, lng, address, name, raw_data')
      .eq('category', 'HOSPITAL')
      .in('sido', aliases);

    if (selectErr) {
      throw new Error(`DB Existence Check Failed: ${selectErr.message}`);
    }

    const existingMap = new Map();
    if (existingHospitals) {
      existingHospitals.forEach(h => {
        if (h.lat && h.lng) {
          const val = { id: h.id, lat: h.lat, lng: h.lng, address: h.address || '', name: h.name || '' };
          existingMap.set(h.id, val);
          if (h.raw_data?.hpid) {
            existingMap.set(h.raw_data.hpid, val);
          }
          if (h.name) {
            existingMap.set(h.name, val);
          }
        }
      });
    }

    const url = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${MOIS_API_KEY}&STAGE1=${encodeURIComponent(sido)}&STAGE2=&pageNo=1&numOfRows=100&_type=json`;
    const data = await fetchWithRetry(url);
    const items = data.response?.body?.items?.item;

    if (items) {
      const itemList = Array.isArray(items) ? items : [items];

      for (const item of itemList) {
        console.log(` -> Processing hospital: "${item.dutyName}"`);
        const hAddr = item.dutyAddr || '';
        const tempFid = generateId('NMC_HOSPITAL', item.dutyName, hAddr);
        
        const exist = existingMap.get(tempFid) || 
                      (item.hpid ? existingMap.get(item.hpid) : null) || 
                      existingMap.get(item.dutyName);

        let hLat = parseFloat(item.wgs84Lat);
        let hLng = parseFloat(item.wgs84Lon);
        let finalAddr = hAddr;
        let finalFid = exist ? exist.id : tempFid;

        if (exist) {
          hLat = exist.lat;
          hLng = exist.lng;
          if (exist.address) finalAddr = exist.address;
        } 
        else if (!hLat || !hLng || hLat <= 33 || hLat >= 39 || hLng <= 124 || hLng >= 132) {
          const coords = await getKakaoCoordinates(hAddr);
          if (coords && coords.lat && coords.lng) {
            hLat = coords.lat;
            hLng = coords.lng;
          }
        }

        if (hLat && hLng) {
          if (seenIds.has(finalFid)) continue;
          seenIds.add(finalFid);
          stat.fetched.active++;

          let details = null;
          try {
            if (item.hpid) {
              details = await fetchHospitalDetails(item.hpid, MOIS_API_KEY);
              console.log(`    Detail fetched successfully for HPID: ${item.hpid}`);
            }
          } catch (de) {
            console.warn(`    [NMC Detail Sync Fail] hospital: ${item.dutyName}, err: ${de.message}`);
          }
        }
      }
    }
    console.log(`🏥 [NMC TEST] SUCCESS for ${sido}!`);
  } catch (e) {
    console.error(`🏥 [NMC TEST] FAILED:`, e);
  }
}

async function run() {
    await syncHospitalsTest('울산광역시');
    await syncHospitalsTest('세종특별자치시');
}

run();
