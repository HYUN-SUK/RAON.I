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

const MODEL_NAME = 'gemini-2.5-flash';
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL_NAME}:generateContent?key=${GEMINI_API_KEY}`;

// CLI 인수 추출
const args = process.argv.slice(2);
const limit = parseInt(getArgValue('--limit') || '50', 10); // 기본 limit 50
const cursorFile = 'scratch/last_gemini_cursor_id.txt';
const dryRun = args.includes('--dry-run');

function getArgValue(flag) {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1] : null;
}

// 마트 프롬프트 생성
function buildMartPrompt(name, details) {
  return `당신은 캠핑/여행 전문 AI 카피라이터입니다. 다음 마트의 실제 메타데이터를 기반으로, 캠퍼들이 생필품이나 장을 볼 때 유용한 한 줄 설명(Description)을 사실에만 기반하여 작성해 주세요.
- 이름: ${name}
- 영업시간: ${details.operating_hours || '정보 없음'}
- 휴무일: ${details.closed_days || '정보 없음'}
- 주차: ${details.parking_available || '정보 없음'}
[제약사항] 마트 정보와 주차 정보를 담아 딱 한 문장(30~45자 내외)으로 사실에만 기반하여 작성하세요. 추측성 묘사는 배제합니다.`;
}

// 제미나이 API 호출 헬퍼 (429 Rate Limit 자동 재시도 포함)
async function requestGemini(prompt, retries = 3) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    const res = await fetch(GEMINI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }]
      })
    });
    
    if (res.status === 429) {
      const errData = await res.json().catch(() => ({}));
      const msg = errData.error?.message || '';
      console.warn(`⚠️ [429 Rate Limit] Attempt ${attempt}/${retries} failed. Waiting 5 seconds before retry...`);
      await new Promise(r => setTimeout(r, 5000));
      continue;
    }
    
    if (!res.ok) {
      const errData = await res.json().catch(() => ({}));
      throw new Error(`Gemini API Error (HTTP ${res.status}): ${errData.error?.message || res.statusText}`);
    }
    
    const data = await res.json();
    const reply = data.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
    if (!reply) throw new Error("Received empty reply from Gemini API");
    return reply;
  }
  throw new Error(`Failed to call Gemini API after ${retries} attempts due to Rate Limit (429).`);
}

// 전화번호 추출 헬퍼
function extractTel(rawData) {
  return rawData?.['전화번호'] || rawData?.['tel'] || rawData?.['RELAX_RSTRNT_TEL'] || '';
}

// 전화번호 포맷팅 헬퍼 (0312345678 → 031-234-5678)
function formatTel(tel) {
  if (!tel || tel.trim().length === 0) return '';
  const digits = tel.replace(/[^0-9]/g, '');
  if (digits.length === 10) return `${digits.slice(0,3)}-${digits.slice(3,6)}-${digits.slice(6)}`;
  if (digits.length === 11) return `${digits.slice(0,3)}-${digits.slice(3,7)}-${digits.slice(7)}`;
  if (digits.length === 9) return `${digits.slice(0,2)}-${digits.slice(2,5)}-${digits.slice(5)}`;
  return digits; // 포맷 불가 시 원본 반환
}

// ========== 3분류 판정 함수 ==========
// 반환값: 'CHAIN_TEMPLATE' | 'REAL_DATA' | 'NO_DETAIL'

// 체인형 템플릿 감지 키워드
const CHAIN_TEMPLATE_KEYWORDS = ['점포별 상이', '지자체별 상이', '점포별상이', '지자체별상이'];

function classifyMartData(rawData) {
  if (rawData.enriched !== true) return 'NO_DETAIL';

  const hours = rawData.operating_hours || '';
  const closed = rawData.closed_days || '';
  const parking = rawData.parking_available || '';

  // B유형: 주소 오염 데이터 → 상세 없음 취급
  if (hours.includes('지번 :') || hours.includes('복사')) return 'NO_DETAIL';

  // 체인형 템플릿 감지: 영업시간 또는 휴무일에 템플릿 키워드가 포함
  const isChainHours = CHAIN_TEMPLATE_KEYWORDS.some(kw => hours.includes(kw));
  const isChainClosed = CHAIN_TEMPLATE_KEYWORDS.some(kw => closed.includes(kw));
  const isChainParking = parking.includes('일부 소형 마트 제외');

  if (isChainHours || isChainClosed || isChainParking) return 'CHAIN_TEMPLATE';

  // 실제 크롤링 데이터 판정: 요일별 시간 패턴 또는 유효한 고유 정보
  const hasRealHours = hours.length > 0 &&
                       !hours.includes('정보 없음') &&
                       !hours.includes('상시 개방');
  const hasRealClosed = closed.length > 0 &&
                        !closed.includes('정보 없음') &&
                        !closed.includes('연중무휴 또는 정보 없음');
  const hasRealParking = parking.length > 0 &&
                         !parking.includes('확인 불가');

  if (hasRealHours || hasRealClosed || hasRealParking) return 'REAL_DATA';

  return 'NO_DETAIL';
}

// ========== 1줄 설명 생성 함수 (분류별) ==========

// ① 체인형 마트 스마트 템플릿 (0원 즉시 생성)
function makeChainTemplateDescription(name, rawData) {
  const hours = rawData.operating_hours || '';
  // 기본 영업시간 추출 ("09:00 - 22:00 (점포별 상이)" → "09-22시")
  const hoursMatch = hours.match(/(\d{1,2}):?(\d{2})\s*[-~]\s*(\d{1,2}):?(\d{2})/);
  const hoursStr = hoursMatch ? `${hoursMatch[1]}-${hoursMatch[3]}시` : '09-22시';

  const tel = extractTel(rawData);
  const telStr = tel ? ` (${formatTel(tel)})` : '';

  return `기본 ${hoursStr}, 2·4주 일요일 휴무(지역별 상이). 방문 전 확인 권장${telStr}`;
}

// ③ 상세 없음 로컬 Fallback (0원 즉시 생성)
function makeLocalFallbackDescription(name, address, rawData) {
  const cleanAddr = address ? address.split(' ').slice(0, 3).join(' ') : '해당 지역';
  const tel = extractTel(rawData);
  const telSuffix = tel ? ` (${formatTel(tel)})` : '';
  return `${cleanAddr} 인근의 마트 ${name}입니다. 세부 정보는 사전 확인을 권장합니다.${telSuffix}`.trim();
}

async function enrichMartDescriptions() {
  console.log(`=== Starting Gemini Mart Description Enrichment ===`);
  console.log(`Limit: ${limit}, Dry-Run: ${dryRun}, Target Category: MART`);
  const startTime = Date.now();

  let lastId = '';
  if (fs.existsSync(cursorFile)) {
    lastId = fs.readFileSync(cursorFile, 'utf8').trim();
  }

  console.log(`Starting cursor from ID: [${lastId || 'START OF TABLE'}]`);

  // Supabase에서 PK 정렬 및 limit(1000)으로 페이징 스캔하여 타임아웃 방어
  let query = supabase
    .from('master_places')
    .select('id, name, address, lat, lng, category, raw_data, description, api_source, is_active')
    .order('id')
    .limit(1000);

  if (lastId) {
    query = query.gt('id', lastId);
  }

  const { data: rawPlaces, error: fetchErr } = await query;
  if (fetchErr) {
    console.error("❌ Error fetching places from Supabase:", fetchErr.message);
    process.exit(1);
  }

  if (!rawPlaces || rawPlaces.length === 0) {
    console.log("🎉 No more places found to scan in master_places. Table scan complete.");
    process.exit(0);
  }

  // 1. 메모리 상에서 MART이고 미적재 장소 필터링
  //    이미 제미나이/체인템플릿/폴백 처리 완료된 건은 제외
  const DONE_SOURCES = ['gemini-2.5-flash', 'CHAIN_TEMPLATE', 'LOCAL_FALLBACK'];
  const targetPlaces = rawPlaces.filter(p => {
    if (p.category !== 'MART' || !p.is_active) return false;
    const src = p.raw_data?.description_api_source;
    return !DONE_SOURCES.includes(src);
  });

  const lastScannedId = rawPlaces[rawPlaces.length - 1].id;

  if (targetPlaces.length === 0) {
    console.log(`💡 No pending MART targets found in this scan chunk (Scanned up to ID: ${lastScannedId}). Skipping...`);
    // 스킵 시에는 드라이런 여부와 관계없이 항상 커서를 전진 (로컬 파일이므로 DB 영향 없음)
    fs.writeFileSync(cursorFile, lastScannedId, 'utf8');
    console.log(`Cursor advanced to: ${lastScannedId}`);
    process.exit(0);
  }

  console.log(`🎯 Found ${targetPlaces.length} target MART places to process in this chunk (Scanned ${rawPlaces.length} rows).`);

  const buffer = [];
  let geminiCount = 0;
  let chainCount = 0;
  let fallbackCount = 0;
  let stopTriggered = false;

  for (const place of targetPlaces) {
    if (geminiCount >= limit) {
      console.log(`\n🛑 Reached specified limit of ${limit} Gemini API calls. Stopping loop.`);
      break;
    }

    const { id, name, address, lat, lng, raw_data, api_source } = place;
    const raw = raw_data || {};
    const classification = classifyMartData(raw);

    // ① 체인형 템플릿 → 0원 스마트 로컬 템플릿
    if (classification === 'CHAIN_TEMPLATE') {
      const chainDesc = makeChainTemplateDescription(name, raw);
      chainCount++;
      
      console.log(`[CHAIN TEMPLATE] ${name} -> "${chainDesc}"`);
      
      buffer.push({
        id,
        category: 'MART',
        name,
        address,
        lat,
        lng,
        description: chainDesc,
        raw_data: { ...raw, description_enriched: true, description_api_source: 'CHAIN_TEMPLATE' },
        api_source,
        updated_at: new Date().toISOString()
      });
      continue;
    }

    // ③ 상세 없음 → 0원 로컬 Fallback
    if (classification === 'NO_DETAIL') {
      const localDesc = makeLocalFallbackDescription(name, address, raw);
      fallbackCount++;
      
      console.log(`[LOCAL FALLBACK] ${name} -> "${localDesc}"`);
      
      buffer.push({
        id,
        category: 'MART',
        name,
        address,
        lat,
        lng,
        description: localDesc,
        raw_data: { ...raw, description_enriched: true, description_api_source: 'LOCAL_FALLBACK' },
        api_source,
        updated_at: new Date().toISOString()
      });
      continue;
    }

    // ② 실제 크롤링 데이터 보유 → 제미나이 API 호출
    // 무료 API Rate Limit(20 RPM) 준수를 위해 5초 딜레이 (안전 마진 포함)
    console.log(`\n⏳ [Rate Limit Control] Waiting 5 seconds before calling Gemini API...`);
    await new Promise(r => setTimeout(r, 5000));

    const prompt = buildMartPrompt(name, raw);
    
    try {
      if (dryRun) {
        console.log(`[DRY-RUN Gemini Request] ${name} -> Prompt: ${prompt.replace(/\n/g, ' ')}`);
        successCount++;
        buffer.push({
          id,
          category: 'MART',
          name,
          address,
          lat,
          lng,
          description: `[DRY-RUN] 요약본 예정`,
          raw_data: { ...raw, description_enriched: true, description_api_source: MODEL_NAME },
          api_source,
          updated_at: new Date().toISOString()
        });
        continue;
      }

      console.log(`🚀 [Gemini Request] Generating description for: ${name}`);
      const reply = await requestGemini(prompt);
      const cleanReply = reply.replace(/^["']|["']$/g, '').trim();
      
      console.log(`✨ [GEMINI SUCCESS] ${name} -> "${cleanReply}"`);
      geminiCount++;

      buffer.push({
        id,
        category: 'MART',
        name,
        address,
        lat,
        lng,
        description: cleanReply,
        raw_data: { ...raw, description_enriched: true, description_api_source: MODEL_NAME },
        api_source,
        updated_at: new Date().toISOString()
      });
    } catch (err) {
      console.error(`❌ [ERROR] Failed to enrich ${name}: ${err.message}`);
      stopTriggered = true;
      break; // 에러 발생 시 즉시 중단하여 다음 배치를 기약함
    }
  }

  // Supabase Upsert 처리
  if (buffer.length > 0 && !dryRun) {
    console.log(`\n⏳ Writing ${buffer.length} records to Supabase (master_places)...`);
    const { error: upsertErr } = await supabase
      .from('master_places')
      .upsert(buffer, { onConflict: 'id' });

    if (upsertErr) {
      console.error("❌ Supabase upsert failed:", upsertErr.message);
      process.exit(1);
    }
    console.log("✅ Successfully updated DB descriptions!");
  }

  // 커서 업데이트 정책:
  // 스캔된 청크의 마지막 행 ID(lastScannedId)로 커서를 전진시켜
  // 다음 배치에서 같은 청크를 반복 스캔하지 않도록 한다.
  // 커서 파일은 로컬 파일이므로 드라이런 여부와 관계없이 항상 전진시킨다.
  if (buffer.length > 0 || targetPlaces.length === 0) {
    fs.writeFileSync(cursorFile, lastScannedId, 'utf8');
    console.log(`\n📝 Cursor file updated to lastScannedId: ${lastScannedId}`);
  } else {
    console.log(`\n⚠️ No entries processed successfully. Cursor not updated.`);
  }

  const duration = Date.now() - startTime;
  console.log(`\n=== Chunk Enrichment Result Summary ===`);
  console.log(`Scanned Rows: ${rawPlaces.length}`);
  console.log(`Processed (Gemini API): ${geminiCount}`);
  console.log(`Processed (Chain Template): ${chainCount}`);
  console.log(`Processed (Local Fallback): ${fallbackCount}`);
  console.log(`Total Written: ${buffer.length}`);
  console.log(`Elapsed Time: ${(duration / 1000).toFixed(2)} seconds`);

  if (stopTriggered) {
    process.exit(1); // 에러 발생 중단 시 에러 코드로 종료
  } else {
    process.exit(0);
  }
}

enrichMartDescriptions();
