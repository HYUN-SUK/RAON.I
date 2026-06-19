import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { v5 as uuidv5 } from 'uuid';
import fetch from 'node-fetch';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const TOUR_API_KEY = process.env.TOUR_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

// 결정적 Fact ID 생성기
const generateFactId = (source: string, name: string, address: string) => 
  uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const secret = searchParams.get('secret');

  // 1. 크론 시크릿 인증
  if (secret !== CRON_SECRET && req.headers.get('Authorization') !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!SUPABASE_URL || !SUPABASE_KEY || !TOUR_API_KEY) {
    return NextResponse.json({ error: 'Missing environment configurations' }, { status: 500 });
  }

  const startTime = Date.now();
  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);
  
  // 시도별 통계 기록용 맵
  const statsMap = new Map<string, {
    region: string;
    name: string;
    label: string;
    existing_count: number;
    fetched_count: number;
    new_count: { active: number; inactive: number };
    updated_count: { active: number; inactive: number };
    final_count: number;
  }>();

  // 전국 17개 시도 매핑 헬퍼
  const SIDO_CODES: Record<string, string> = {
    '1': '서울', '2': '인천', '3': '대전', '4': '대구', '5': '광주',
    '6': '부산', '7': '울산', '8': '세종', '31': '경기', '32': '강원',
    '33': '충북', '34': '충남', '35': '전북', '36': '전남', '37': '경북',
    '38': '경남', '39': '제주'
  };

  // 통계 초기화
  Object.values(SIDO_CODES).forEach(region => {
    statsMap.set(region, {
      region,
      name: 'FESTIVAL',
      label: '축제(TourAPI)',
      existing_count: 0,
      fetched_count: 0,
      new_count: { active: 0, inactive: 0 },
      updated_count: { active: 0, inactive: 0 },
      final_count: 0
    });
  });

  try {
    // 2. 현재 DB에 존재하는 기존 축제 개수 카운팅 (통계용)
    const { data: existingList } = await supabase
      .from('smart_plan_facts')
      .select('id, address')
      .eq('category', 'FESTIVAL');

    if (existingList) {
      existingList.forEach(item => {
        const addr = item.address || '';
        const region = Object.values(SIDO_CODES).find(r => addr.startsWith(r)) || '기타';
        const stat = statsMap.get(region);
        if (stat) stat.existing_count++;
      });
    }

    // 3. TourAPI 축제 조회 파라미터 (당월/익월 축제 전체 수집)
    const today = new Date();
    const todayStr = today.toISOString().split('T')[0].replace(/-/g, ''); // YYYYMMDD
    
    // 최대 2000개 로드하여 전국 데이터를 한번에 획득 (KorService2/searchFestival2 규격 적용)
    const tourUrl = `http://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${TOUR_API_KEY}&eventStartDate=${todayStr}&numOfRows=2000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;
    
    const tourRes = await fetch(tourUrl);
    const tourData: any = await tourRes.json();
    const items = tourData.response?.body?.items?.item || [];
    const festivalList = Array.isArray(items) ? items : [items];

    console.log(`[Weekly Festival Sync] Fetched ${festivalList.length} items from TourAPI.`);

    const upsertList: any[] = [];
    const seenIds = new Set<string>();

    for (const item of festivalList) {
      if (!item.title || !item.mapy || !item.mapx) continue;

      const addr1 = item.addr1 || '';
      const fid = generateFactId('TOUR_FSTVL', item.title, addr1);
      
      if (seenIds.has(fid)) continue;
      seenIds.add(fid);

      const region = Object.values(SIDO_CODES).find(r => addr1.startsWith(r)) || '기타';
      const stat = statsMap.get(region);
      if (stat) stat.fetched_count++;

      // 축제 10개 상세 정보 매핑 및 카테고리 폴백 상수 적용
      const name = item.title;
      const playtime = item.playtime || "행사별 상이";
      const usefee = item.usefee || "무료 또는 현장 확인 필요";
      const parking = item.parking || "확인 불가";
      const eventstartdate = item.eventstartdate || "";
      const eventenddate = item.eventenddate || "";

      upsertList.push({
        id: fid,
        api_source: 'TOUR_FSTVL',
        category: 'FESTIVAL',
        name: name,
        address: addr1 || '주소 정보 없음',
        lat: parseFloat(item.mapy),
        lng: parseFloat(item.mapx),
        trust_score: 45,
        description: `${name}은(는) ${eventstartdate ? eventstartdate + '부터 ' : ''}개최되는 지역 축제/행사입니다.`,
        raw_data: {
          event_start_date: eventstartdate,
          event_end_date: eventenddate,
          playtime: playtime,
          usefee: usefee,
          eventplace: item.eventplace || '현장 특설 무대',
          parking: parking,
          sponsor1tel: item.sponsor1tel || '정보 없음',
          sponsor2tel: item.sponsor2tel || '정보 없음',
          homepage_url: item.homepage_url || '',
          sub_description: item.sub_description || item.title || '',
          firstimage: item.firstimage || item.firstimage2 || '',
          enriched: true,
          // 기본 스펙 호환용 매핑
          operating_hours: playtime,
          closed_days: "연중무휴 또는 정보 없음",
          representative_menu: [],
          parking_available: parking,
          pet_friendly: "확인 불가"
        },
        updated_at: new Date().toISOString()
      });
    }

    let insertedCount = 0;

    // 4. Supabase DB Upsert (200개 청크씩 분할 배포)
    if (upsertList.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < upsertList.length; i += chunkSize) {
        const chunk = upsertList.slice(i, i + chunkSize);
        const { error: upsertErr } = await supabase
          .from('smart_plan_facts')
          .upsert(chunk, { onConflict: 'id' });

        if (upsertErr) {
          console.error(`[Weekly Festival Sync] Chunk upsert error:`, upsertErr.message);
          throw upsertErr;
        }
        insertedCount += chunk.length;
      }
    }

    // 5. 시도별 최종 통계 집계
    const { data: finalFestivalList } = await supabase
      .from('smart_plan_facts')
      .select('id, address')
      .eq('category', 'FESTIVAL');

    if (finalFestivalList) {
      finalFestivalList.forEach(item => {
        const addr = item.address || '';
        const region = Object.values(SIDO_CODES).find(r => addr.startsWith(r)) || '기타';
        const stat = statsMap.get(region);
        if (stat) stat.final_count++;
      });
    }

    // 통계 보정 (신규 삽입 및 변경 업데이트 산출)
    statsMap.forEach(stat => {
      const diff = stat.final_count - stat.existing_count;
      if (diff > 0) {
        stat.new_count.active = diff;
        stat.updated_count.active = Math.max(0, stat.fetched_count - diff);
      } else {
        stat.updated_count.active = stat.fetched_count;
      }
    });

    const executionTime = Date.now() - startTime;
    const statsArray = Array.from(statsMap.values()).filter(s => s.fetched_count > 0 || s.existing_count > 0);

    // 6. automation_logs 테이블에 작업 결과 로깅
    const { error: logErr } = await supabase
      .from('automation_logs')
      .insert({
        job_name: 'WEEKLY_FESTIVAL_SYNC',
        status: 'SUCCESS',
        processed_count: insertedCount,
        message: `주간 축제 정보 동기화 완료: ${insertedCount}건 적재.`,
        duration_ms: executionTime,
        api_status: statsArray,
        created_at: new Date().toISOString()
      });

    if (logErr) {
      console.error(`[Weekly Festival Sync] Failed to write automation log:`, logErr.message);
    }

    return NextResponse.json({
      success: true,
      inserted_count: insertedCount,
      duration_ms: executionTime,
      details: statsArray
    });

  } catch (error: any) {
    console.error(`[Weekly Festival Sync] Error:`, error.message);
    
    // 실패 로그 기록
    await supabase.from('automation_logs').insert({
      job_name: 'WEEKLY_FESTIVAL_SYNC',
      status: 'FAILURE',
      processed_count: 0,
      message: `축제 동기화 실패: ${error.message}`,
      duration_ms: Date.now() - startTime,
      created_at: new Date().toISOString()
    });

    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
