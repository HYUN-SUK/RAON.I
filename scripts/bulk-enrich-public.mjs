import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fetchTourPlaceDetails, fetchHospitalDetails } from './utils/public-api-helpers.mjs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PUBLIC_API_KEY = process.env.PUBLIC_DATA_API_KEY;
const NMC_API_KEY = process.env.MOIS_API_KEY || process.env.PUBLIC_DATA_API_KEY;

// v10 규격 표준 폴백 상수 정의 (SPOT, HOSPITAL, FESTIVAL 공공 데이터용)
const CATEGORY_FALLBACKS = {
  SPOT: {
    operating_hours: "상시 개방 또는 정보 없음",
    closed_days: "연중무휴 또는 정보 없음",
    admission_fee: "무료 또는 현장 확인 필요",
    parking_available: "확인 불가",
    kids_friendly: "확인 불가",
    disabled_accessible: "확인 불가 (사전 확인 권장)",
    description: "${name}은(는) 해당 지역의 대표적인 관광명소입니다. 방문 전 개방 여부를 확인해 주세요."
  },
  HOSPITAL: {
    operating_hours: "평일 09:00 - 18:00 (전화 확인 권장)",
    closed_days: "일요일/공휴일 휴무 (응급실 제외)",
    emergency_room: "확인 불가 (119 또는 유선 문의)",
    parking_available: "주차 가능",
    representative_departments: [],
    description: "${name}은(는) 해당 지역의 의료 시설입니다. 응급 상황 시 유선 연락 후 방문하세요."
  },
  FESTIVAL: {
    festival_period: { "start": "일정 확인 필요", "end": "일정 확인 필요" },
    operating_hours: "행사별 상이",
    admission_fee: "무료 또는 현장 확인 필요",
    homepage_url: "",
    organizer_contact: "정보 없음",
    parking_available: "확인 불가",
    description: "${name}은(는) 해당 지역에서 개최되는 축제/행사입니다."
  }
};

async function runBulkEnrich() {
  let sessionStartTime = new Date().toISOString();
  const sessionTimeArgIdx = process.argv.findIndex(arg => arg === '--session-start-time');
  if (sessionTimeArgIdx !== -1 && process.argv[sessionTimeArgIdx + 1]) {
    sessionStartTime = process.argv[sessionTimeArgIdx + 1];
  }

  let lastId = null;
  const lastIdArgIdx = process.argv.findIndex(arg => arg === '--last-id');
  if (lastIdArgIdx !== -1 && process.argv[lastIdArgIdx + 1]) {
    lastId = process.argv[lastIdArgIdx + 1];
  }

  let limit = 1000;
  const limitArgIdx = process.argv.findIndex(arg => arg === '--limit');
  if (limitArgIdx !== -1 && process.argv[limitArgIdx + 1]) {
    limit = parseInt(process.argv[limitArgIdx + 1], 10);
  }

  console.log(`[CLI Public Bulk Enrichment] Starting bulk enrich. Target Limit: ${limit} items.`);

  if (!SUPABASE_URL || !SUPABASE_KEY || !PUBLIC_API_KEY) {
    console.error("Fatal: Missing Supabase or Public Data API Credentials.");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  const startTime = Date.now();

  let successCount = 0;
  let failCount = 0;
  const processedList = [];
  const buffer = [];

  // 카테고리별 실시간 적재 실패/차단 자동 모니터링 변수
  const consecutiveFailuresByCategory = {
    SPOT: 0,
    HOSPITAL: 0,
    FESTIVAL: 0
  };
  const maxConsecutiveFailures = 10;

  function checkRealEnrichedPublic(category, details) {
    if (!details) return false;
    const fb = CATEGORY_FALLBACKS[category];
    if (!fb) return false;

    if (category === 'SPOT') {
      const hasRealFee = details.admission_fee && details.admission_fee !== fb.admission_fee;
      const hasRealParking = details.parking_available && details.parking_available !== fb.parking_available;
      return !!(hasRealFee || hasRealParking);
    }
    if (category === 'HOSPITAL') {
      const hasRealDepts = Array.isArray(details.representative_departments) && details.representative_departments.length > 0;
      return !!hasRealDepts;
    }
    if (category === 'FESTIVAL') {
      const hasRealPeriod = details.festival_period && details.festival_period.start !== fb.festival_period.start;
      return !!hasRealPeriod;
    }
    return false;
  }

  function getAbortedCategory() {
    return Object.keys(consecutiveFailuresByCategory).find(
      cat => consecutiveFailuresByCategory[cat] >= maxConsecutiveFailures
    );
  }

  function consecutiveFailureCheck() {
    return getAbortedCategory() !== undefined;
  }

  try {
    console.log("Querying target places for public bulk enrichment (Cursor-based ID scan)...");
    let selectQuery = supabase
      .from('master_places')
      .select('id, name, address, category, lat, lng, raw_data, description')
      .eq('is_active', true)
      .order('id');

    if (lastId) {
      selectQuery = selectQuery.gt('id', lastId);
    }

    const { data: rawPlaces, error: fetchErr } = await selectQuery.limit(limit);

    if (fetchErr) throw fetchErr;

    if (!rawPlaces || rawPlaces.length === 0) {
      console.log("No more places found in the table. Exiting.");
      const fs = await import('fs');
      await fs.promises.mkdir('scratch', { recursive: true }).catch(() => {});
      await fs.promises.writeFile('scratch/last_public_cursor_id.txt', '', 'utf8').catch(() => {});
      process.exit(0);
    }

    // 다음 배치를 위해 이번 배치의 마지막 ID를 파일에 써둡니다.
    const lastRecordId = rawPlaces[rawPlaces.length - 1].id;
    const fs = await import('fs');
    await fs.promises.mkdir('scratch', { recursive: true }).catch(() => {});
    await fs.promises.writeFile('scratch/last_public_cursor_id.txt', lastRecordId, 'utf8');

    // 메모리 상에서 명소/병원/축제이면서 미시도 건 필터링
    const targetCats = ['SPOT', 'HOSPITAL', 'FESTIVAL'];
    const places = rawPlaces.filter(p => 
      targetCats.includes(p.category) && 
      (p.raw_data?.enriched === undefined || p.raw_data?.enriched === null)
    );

    if (places.length === 0) {
      console.log(`No pending public places in this cursor batch (Scanned ${rawPlaces.length} rows). Skipping to next batch.`);
      process.exit(0);
    }

    console.log(`Found ${places.length} public places to enrich out of ${rawPlaces.length} scanned.`);

    for (const place of places) {
      const abortedCategory = getAbortedCategory();
      if (abortedCategory) {
        console.error(`\n🚨 [ABORT] Consecutive failure threshold (${maxConsecutiveFailures}) reached for category [${abortedCategory}]. Terminating public batch.`);
        break;
      }
      const name = place.name;
      const category = place.category;
      const id = place.id;
      const raw = place.raw_data || {};
      const defaultFallback = { ...CATEGORY_FALLBACKS[category] };
      
      try {
        let details = null;
        let isRealEnriched = false;
        
        if (category === 'SPOT') {
          const contentId = raw.contentid || raw.contentId;
          if (contentId) {
            console.log(` -> Enriched tourist spot: ${name} (ContentID: ${contentId})`);
            details = await fetchTourPlaceDetails(contentId, '12', PUBLIC_API_KEY);
            isRealEnriched = checkRealEnrichedPublic(category, details);
          } else {
            console.warn(` -> Skip ${name} (No contentid found) - Route to Stage 2`);
            isRealEnriched = false;
          }
        } else if (category === 'FESTIVAL') {
          const contentId = raw.contentid || raw.contentId;
          if (contentId) {
            console.log(` -> Enriched festival: ${name} (ContentID: ${contentId})`);
            details = await fetchTourPlaceDetails(contentId, '15', PUBLIC_API_KEY);
            isRealEnriched = checkRealEnrichedPublic(category, details);
          } else {
            console.warn(` -> Skip ${name} (No contentid found)`);
            isRealEnriched = false;
          }
        } else if (category === 'HOSPITAL') {
          const hpid = raw.hpid;
          if (hpid) {
            console.log(` -> Enriched hospital: ${name} (HPID: ${hpid})`);
            details = await fetchHospitalDetails(hpid, NMC_API_KEY);
            isRealEnriched = checkRealEnrichedPublic(category, details);
          } else {
            console.warn(` -> Skip ${name} (No hpid found) - Route to Stage 2`);
            isRealEnriched = false;
          }
        }

        if (isRealEnriched) {
          consecutiveFailuresByCategory[category] = 0;
          successCount++;
        } else {
          consecutiveFailuresByCategory[category]++;
          console.warn(`  [WARN] Public real data enrichment failed for ${name} (${category}). Fallback applied. (Consecutive: ${consecutiveFailuresByCategory[category]})`);
          failCount++;
        }

        const activeDetails = details || defaultFallback;
        const updatedRaw = {
          ...raw,
          enriched: isRealEnriched, // 무조건 true가 아닌 실제 수집 여부 매핑
          operating_hours: activeDetails.operating_hours || raw.operating_hours || defaultFallback.operating_hours,
          closed_days: activeDetails.closed_days || raw.closed_days || defaultFallback.closed_days,
          parking_available: activeDetails.parking_available || raw.parking_available || defaultFallback.parking_available,
          homepage_url: activeDetails.homepage_url || raw.homepage_url || '',
          ...(category === 'SPOT' ? {
            admission_fee: activeDetails.admission_fee || defaultFallback.admission_fee,
            kids_friendly: activeDetails.kids_friendly || defaultFallback.kids_friendly,
            disabled_accessible: activeDetails.disabled_accessible || defaultFallback.disabled_accessible
          } : {}),
          ...(category === 'HOSPITAL' ? {
            emergency_room: activeDetails.emergency_room || defaultFallback.emergency_room,
            representative_departments: activeDetails.representative_departments || defaultFallback.representative_departments
          } : {}),
          ...(category === 'FESTIVAL' ? {
            festival_period: activeDetails.festival_period || defaultFallback.festival_period,
            organizer_contact: activeDetails.organizer_contact || defaultFallback.organizer_contact,
            admission_fee: activeDetails.admission_fee || defaultFallback.admission_fee
          } : {})
        };

        buffer.push({
          id: id,
          api_source: raw.api_source || raw.apiSource || 'PUBLIC_BULK_ENRICHMENT',
          category: category,
          name: name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          description: place.description || activeDetails.description || defaultFallback.description.replace('${name}', name),
          raw_data: updatedRaw,
          updated_at: new Date().toISOString()
        });

        processedList.push(`${name} (${category})`);

      } catch (err) {
        console.error(`    ❌ Error processing ${name}: ${err.message}`);
        consecutiveFailuresByCategory[category]++;
        failCount++;

        // 예외 발생 시에도 updated_at과 함께 enriched: false로 적재하여 중복 호출 방지
        buffer.push({
          id: id,
          api_source: raw.api_source || raw.apiSource || 'PUBLIC_BULK_ENRICHMENT',
          category: category,
          name: name,
          address: place.address,
          lat: place.lat,
          lng: place.lng,
          description: place.description,
          raw_data: {
            ...raw,
            enriched: false,
            enrich_error: err.message
          },
          updated_at: new Date().toISOString()
        });
      }

      // 공공 API 트래픽 제한 방지 지연
      await new Promise(r => setTimeout(r, 200));

      if (buffer.length >= 1000) {
        console.log(`\n⏳ Writing 1000 items bulk chunk to Supabase...`);
        const { error: upsertErr } = await supabase
          .from('master_places')
          .upsert(buffer, { onConflict: 'id' });

        if (upsertErr) {
          console.error(`❌ Bulk upsert failed: ${upsertErr.message}`);
        } else {
          console.log(`✅ Bulk upsert successful!`);
        }
        buffer.length = 0;
      }
    }

    if (buffer.length > 0 && !consecutiveFailureCheck()) {
      console.log(`\n⏳ Writing remaining ${buffer.length} items bulk chunk to Supabase...`);
      const { error: upsertErr } = await supabase
        .from('master_places')
        .upsert(buffer, { onConflict: 'id' });

      if (upsertErr) {
        console.error(`❌ Final bulk upsert failed: ${upsertErr.message}`);
      } else {
        console.log(`✅ Final bulk upsert successful!`);
      }
    }

    const duration = Date.now() - startTime;
    console.log(`\n=== Public API bulk enrichment completed ===`);
    console.log(`Success: ${successCount} items`);
    console.log(`Failed: ${failCount} items`);
    console.log(`Total duration: ${(duration / 1000).toFixed(2)} seconds`);

    const abortedCat = getAbortedCategory();
    await supabase.from('automation_logs').insert({
      job_name: 'PUBLIC_BULK_ENRICHMENT',
      status: consecutiveFailureCheck() ? 'FAILURE' : (successCount > 0 ? 'SUCCESS' : 'FAILURE'),
      processed_count: successCount,
      message: consecutiveFailureCheck()
        ? `공공 API 상세정보 적재 오류 임계값 도달로 강제 중단 (장애 카테고리: ${abortedCat}). 성공 ${successCount}건, 실패 ${failCount}건.`
        : `공공 API 상세정보 벌크 재적재 완료: 성공 ${successCount}건, 실패 ${failCount}건.`,
      duration_ms: duration,
      api_status: {
        attempted: successCount + failCount,
        success: successCount,
        failed: failCount,
        aborted_category: abortedCat || null,
        processed: processedList
      },
      created_at: new Date().toISOString()
    });

    if (consecutiveFailureCheck()) {
      process.exit(1);
    }

  } catch (err) {
    console.error("Fatal error during bulk enrichment:", err.message);
    process.exit(1);
  }
}

runBulkEnrich();
