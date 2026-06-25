import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const GEMINI_API_KEY = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY || !GEMINI_API_KEY) {
  console.error("Fatal: Missing Supabase credentials or Gemini API Key.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// 최신 권장 모델 (2026년 기준)
const MODEL_NAME = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

// CLI 인수 추출
const args = process.argv.slice(2);
const limit = parseInt(getArgValue('--limit') || '1000', 10);
const lastId = getArgValue('--last-id') || null;
const billingMode = getArgValue('--billing') || 'paid'; // 'free' or 'paid'
const dryRun = args.includes('--dry-run');

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

// 카테고리별 제미나이 프롬프트 생성 헬퍼
function buildPrompt(category, name, details) {
  if (category === 'RESTAURANT' || category === 'ROUTE_CAFE') {
    return `당신은 캠핑/여행 전문 AI 카피라이터입니다. 다음 식당/카페의 실제 메타데이터를 기반으로, 여행자들에게 유용하고 매력적인 한 줄 설명(Description)을 사실에만 기반하여 작성해 주세요.
- 이름: ${name}
- 영업시간: ${details.operating_hours || '정보 없음'}
- 휴무일: ${details.closed_days || '정보 없음'}
- 대표메뉴: ${details.representative_menu || '정보 없음'}
- 주차: ${details.parking_available || '정보 없음'}
- 반려동물 동반: ${details.pet_friendly || details.pet_allowed || '정보 없음'}
[제약사항] 딱 한 문장(30~45자 내외)으로 사실에만 기반하여 작성하세요. 추측성 과장 표현(맛집, 최고의 등)은 절대 금지합니다.`;
  }

  if (category === 'MART') {
    return `당신은 캠핑/여행 전문 AI 카피라이터입니다. 다음 마트의 실제 메타데이터를 기반으로, 캠퍼들이 생필품이나 장을 볼 때 유용한 한 줄 설명(Description)을 사실에만 기반하여 작성해 주세요.
- 이름: ${name}
- 영업시간: ${details.operating_hours || '정보 없음'}
- 휴무일: ${details.closed_days || '정보 없음'}
- 주차: ${details.parking_available || '정보 없음'}
[제약사항] 마트 정보와 주차 정보를 담아 딱 한 문장(30~45자 내외)으로 사실에만 기반하여 작성하세요. 추측성 묘사는 배제합니다.`;
  }

  // 공공 카테고리 (SPOT, HOSPITAL, FESTIVAL 등) 상세정보 존재 시
  return `당신은 여행 전문 AI 카피라이터입니다. 다음 장소의 실제 상세 메타데이터를 기반으로 사실에 입각한 한 줄 설명(Description)을 작성해 주세요.
- 이름: ${name}
- 상세정보: ${JSON.stringify(details)}
[제약사항] 위 상세 내용에 나온 고유 정보(요금, 개요, 진료과목, 기간 등)를 요약하여 딱 한 문장(30~45자 내외)으로 사실에만 기반하여 작성하세요.`;
}

// 제미나이 API 호출 헬퍼
async function requestGemini(prompt) {
  try {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Gemini API Error (HTTP ${res.status}): ${errData.error?.message || res.statusText}`);
    }
    
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) throw new Error("Received empty reply from Gemini API");
    return reply;
  } catch (err) {
    throw err;
  }
}

// 0원 로컬 Fallback 처리 헬퍼 (상세 미적재용)
function makeLocalFallbackDescription(name, category, address) {
  const categoryNameKo = {
    RESTAURANT: '식당',
    ROUTE_CAFE: '카페',
    MART: '마트',
    SPOT: '관광명소',
    HOSPITAL: '병원/의료시설',
    FESTIVAL: '축제/행사'
  }[category] || category || '장소';

  const cleanAddr = address ? address.split(' ').slice(0, 3).join(' ') : '해당 지역';
  return `${name}은(는) ${cleanAddr} 인근에 위치한 ${categoryNameKo} 관련 장소입니다. 구체적인 운영 및 이용 정보는 방문 전 확인을 권장합니다.`;
}

// 핵심 비즈니스 로직
async function enrichDescriptions() {
  console.log(`[Gemini Description Enrichment] Billing Mode: ${billingMode}, Limit: ${limit}, Dry-Run: ${dryRun}`);
  const startTime = Date.now();

  // 1. Supabase에서 적재할 후보지 쿼리
  let selectQuery = supabase
    .from('master_places')
    .select('id, name, address, lat, lng, category, raw_data, description, api_source')
    .eq('is_active', true)
    .order('id');

  if (lastId) {
    selectQuery = selectQuery.gt('id', lastId);
  }

  const { data: rawPlaces, error: fetchErr } = await selectQuery.limit(limit);
  if (fetchErr) {
    console.error("Error fetching places from Supabase:", fetchErr.message);
    process.exit(1);
  }

  if (!rawPlaces || rawPlaces.length === 0) {
    console.log("No more places found to enrich. Exiting.");
    // 커서 백업 초기화
    if (!dryRun) {
      fs.mkdirSync('scratch', { recursive: true });
      fs.writeFileSync('scratch/last_gemini_cursor_id.txt', '', 'utf8');
    }
    process.exit(0);
  }

  // 2. 이력을 중복 적재하지 않기 위해 필터링
  // raw_data.description_enriched === true 인 건은 건너뜁니다.
  const targetPlaces = rawPlaces.filter(p => !p.raw_data?.description_enriched);

  // 다음 회차 스캔을 위해 마지막 ID 저장
  const lastRecordId = rawPlaces[rawPlaces.length - 1].id;
  if (!dryRun) {
    fs.mkdirSync('scratch', { recursive: true });
    fs.writeFileSync('scratch/last_gemini_cursor_id.txt', lastRecordId, 'utf8');
  }

  if (targetPlaces.length === 0) {
    console.log(`All ${rawPlaces.length} places in this chunk are already enriched. Skipping to next chunk.`);
    process.exit(0);
  }

  console.log(`Found ${targetPlaces.length} target places to enrich in this chunk (Scanned ${rawPlaces.length} rows).`);

  const buffer = [];
  const concurrencyLimit = billingMode === 'paid' ? 15 : 1;
  const delayBetweenRequests = billingMode === 'paid' ? 150 : 4500; // paid일 때는 150ms 딜레이, free일 때는 4.5초 대기

  let successCount = 0;
  let fallbackCount = 0;
  let errorCount = 0;

  // 병렬 풀 단위 실행을 위한 배치 분할 처리
  for (let i = 0; i < targetPlaces.length; i += concurrencyLimit) {
    const chunk = targetPlaces.slice(i, i + concurrencyLimit);
    
    await Promise.all(chunk.map(async (place) => {
      const { id, name, category, address, raw_data, api_source } = place;
      const raw = raw_data || {};
      
      // 💡 [최적화] 상세정보가 없는 장소(enriched: false/null)는 0원 로컬 Fallback 처리
      const hasDetails = raw.enriched === true;
      
      if (!hasDetails) {
        const localDesc = makeLocalFallbackDescription(name, category, address);
        fallbackCount++;
        if (dryRun) {
          console.log(`[DRY-RUN Fallback] ${name} (${category}) -> "${localDesc}"`);
        }
        buffer.push({
          id,
          description: localDesc,
          raw_data: { ...raw, description_enriched: true, description_api_source: 'LOCAL_FALLBACK' },
          api_source,
          updated_at: new Date().toISOString()
        });
        return;
      }

      // 💡 상세정보가 있는 경우 제미나이 호출
      const prompt = buildPrompt(category, name, raw);
      
      // Free 모드나 호출 간 약간의 지연 주입
      if (delayBetweenRequests > 0) {
        const randDelay = Math.random() * 50; // 약간의 지터 추가
        await new Promise(r => setTimeout(r, delayBetweenRequests + randDelay));
      }

      try {
        if (dryRun) {
          console.log(`[DRY-RUN Gemini Request] ${name} (${category}) Prompt: ${prompt.replace(/\n/g, ' ')}`);
          successCount++;
          buffer.push({
            id,
            description: `[DRY-RUN] 요약본 예정`,
            raw_data: { ...raw, description_enriched: true, description_api_source: MODEL_NAME },
            api_source,
            updated_at: new Date().toISOString()
          });
          return;
        }

        const reply = await requestGemini(prompt);
        // 따옴표 문자 제거 ("꽃향기 가득한 카페입니다" -> 꽃향기 가득한 카페입니다)
        const cleanReply = reply.replace(/^["']|["']$/g, '').trim();
        
        console.log(`[SUCCESS] ${name} (${category}) -> "${cleanReply}"`);
        successCount++;
        buffer.push({
          id,
          description: cleanReply,
          raw_data: { ...raw, description_enriched: true, description_api_source: MODEL_NAME },
          api_source,
          updated_at: new Date().toISOString()
        });
      } catch (err) {
        errorCount++;
        console.error(`[ERROR] Failed to enrich ${name} (${category}): ${err.message}`);
        // 에러가 났을 때는 다음 스캔 때 다시 시도할 수 있도록 description_enriched 마킹을 생략합니다.
      }
    }));
  }

  // 3. Supabase에 결과 Upsert (기존 상세정보 보호를 위해 description, raw_data, updated_at 만 부분 업데이트)
  if (buffer.length > 0 && !dryRun) {
    console.log(`\n⏳ Writing ${buffer.length} enriched descriptions to Supabase master_places...`);
    
    // master_places 테이블의 기존 필드를 보호하며 특정 컬럼만 upsert하기 위해 
    // supabase.upsert를 사용합니다. (id가 매칭되면 description, raw_data, updated_at만 갱신하도록 구성)
    const upsertData = buffer.map(item => ({
      id: item.id,
      description: item.description,
      raw_data: item.raw_data,
      api_source: item.api_source,
      updated_at: item.updated_at
    }));

    const { error: upsertErr } = await supabase
      .from('master_places')
      .upsert(upsertData, { onConflict: 'id' });

    if (upsertErr) {
      console.error("❌ Supabase upsert failed:", upsertErr.message);
      process.exit(1);
    }
    console.log("✅ Successfully updated descriptions!");
  }

  const duration = Date.now() - startTime;
  console.log(`\n=== Chunk Enrichment Result Summary ===`);
  console.log(`Scanned Rows: ${rawPlaces.length}`);
  console.log(`Processed (Gemini Success): ${successCount}`);
  console.log(`Processed (Local Fallback): ${fallbackCount}`);
  console.log(`Failed (Error): ${errorCount}`);
  console.log(`Elapsed Time: ${(duration / 1000).toFixed(2)} seconds`);

  // 무료 빌링 모드 1,500건 제어
  if (billingMode === 'free' && successCount >= 1500) {
    console.log("⚠️ Free Tier usage limit (1500 calls) reached for this session. Exiting.");
    process.exit(0);
  }
}

enrichDescriptions();
