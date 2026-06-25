import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing Supabase credentials");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 시도 정규화 규칙 (파싱된 짧은 주소 조각을 표준 시도명으로 매핑)
const SIDO_STANDARD_MAP = {
    '서울': '서울특별시', '서울특별시': '서울특별시',
    '부산': '부산광역시', '부산광역시': '부산광역시',
    '대구': '대구광역시', '대구광역시': '대구광역시',
    '인천': '인천광역시', '인천광역시': '인천광역시',
    '광주': '광주광역시', '광주광역시': '광주광역시',
    '대전': '대전광역시', '대전광역시': '대전광역시',
    '울산': '울산광역시', '울산광역시': '울산광역시',
    '세종': '세종특별자치시', '세종특별자치시': '세종특별자치시', '세종시': '세종특별자치시',
    '경기': '경기도', '경기도': '경기도',
    '강원': '강원특별자치도', '강원도': '강원특별자치도', '강원특별자치도': '강원특별자치도',
    '충북': '충청북도', '충청북도': '충청북도',
    '충남': '충청남도', '충청남도': '충청남도',
    '전북': '전북특별자치도', '전라북도': '전북특별자치도', '전북특별자치도': '전북특별자치도',
    '전남': '전라남도', '전라남도': '전라남도',
    '경북': '경상북도', '경상북도': '경상북도',
    '경남': '경상남도', '경상남도': '경상남도',
    '제주': '제주특별자치도', '제주도': '제주특별자치도', '제주특별자치도': '제주특별자치도'
};

async function backfill() {
  console.log("🚀 Starting Null Address Backfill Batch (Loop Mode)...");

  let totalSuccess = 0;
  let totalSkipped = 0;
  let lastId = '';
  const limit = 1000;

  while (true) {
    let query = supabase
      .from('master_places')
      .select('id, name, address, category, sido, sigungu')
      .eq('category', 'SPOT')
      .eq('is_active', true)
      .or('sido.is.null,sigungu.is.null')
      .order('id')
      .limit(limit);

    if (lastId) {
      query = query.gt('id', lastId);
    }

    const { data: targets, error: fetchErr } = await query;

    if (fetchErr) {
      console.error("❌ Error fetching target null places:", fetchErr.message);
      break;
    }

    if (!targets || targets.length === 0) {
      break;
    }

    console.log(`\n--- Processing chunk of ${targets.length} places (Last ID: [${lastId || 'START'}]) ---`);

    for (const place of targets) {
      const addr = place.address ? place.address.trim() : '';
      if (!addr) {
        console.warn(`    ⚠️ [SKIP] Place [${place.name}] has no address string.`);
        totalSkipped++;
        continue;
      }

      const parts = addr.split(/\s+/).filter(Boolean);
      if (parts.length < 2) {
        console.warn(`    ⚠️ [SKIP] Place [${place.name}] has invalid short address: "${addr}"`);
        totalSkipped++;
        continue;
      }

      let parsedSido = parts[0];
      let parsedSigungu = parts[1];

      if (SIDO_STANDARD_MAP[parsedSido]) {
        parsedSido = SIDO_STANDARD_MAP[parsedSido];
      }

      const sidoShortMap = {
        '부산광역시': '부산', '대구광역시': '대구', '인천광역시': '인천',
        '광주광역시': '광주', '대전광역시': '대전', '울산광역시': '울산'
      };
      const ambiguousGus = ['중구', '동구', '서구', '남구', '북구', '강서구'];
      if (sidoShortMap[parsedSido] && ambiguousGus.includes(parsedSigungu)) {
        parsedSigungu = `${parsedSigungu}(${sidoShortMap[parsedSido]})`;
      }

      const { error: updateErr } = await supabase
        .from('master_places')
        .update({
          sido: parsedSido,
          sigungu: parsedSigungu,
          updated_at: new Date().toISOString()
        })
        .eq('id', place.id);

      if (updateErr) {
        console.error(`      ❌ Update failed for [${place.name}]:`, updateErr.message);
        totalSkipped++;
      } else {
        totalSuccess++;
      }
    }

    lastId = targets[targets.length - 1].id;
    if (targets.length < limit) break;
  }

  console.log(`\n🏁 [FINISHED] Backfill Completed. Total Success: ${totalSuccess} | Total Skipped/Failed: ${totalSkipped}`);
}

backfill();
