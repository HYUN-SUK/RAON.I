'use server';

import { assertAdmin } from '@/lib/auth-guard';
import { createAdminClient } from '@/lib/supabase-admin';
import { v5 as uuidv5 } from 'uuid';
import { revalidatePath } from 'next/cache';

const MY_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

const generateFactId = (source: string, name: string, address: string) => 
  uuidv5(`${source}|${String(name).trim()}|${String(address).trim()}`, MY_NAMESPACE);

const SIDO_CODES: Record<string, string> = {
  '1': '서울', '2': '인천', '3': '대전', '4': '대구', '5': '광주',
  '6': '부산', '7': '울산', '8': '세종', '31': '경기', '32': '강원',
  '33': '충북', '34': '충남', '35': '전북', '36': '전남', '37': '경북',
  '38': '경남', '39': '제주'
};

/**
 * 관리자 전용 주간 전국 축제 수동 즉시 동기화 Server Action
 * - assertAdmin(): 슈퍼 관리자 권한 철저 검증
 * - createAdminClient(): Service Role DB 연동
 * - TourAPI 정밀 수집 및 master_places 카테고리 FESTIVAL 격리 Upsert
 * - automation_logs 테이블 성공/실패 기록
 */
export async function triggerWeeklyFestivalSyncAction(): Promise<{
  success: boolean;
  insertedCount?: number;
  durationMs?: number;
  error?: string;
}> {
  const startTime = Date.now();

  try {
    await assertAdmin();

    const supabase = createAdminClient();
    const tourApiKey = process.env.TOUR_API_KEY || process.env.PUBLIC_DATA_API_KEY;

    if (!tourApiKey) {
      return { success: false, error: 'TourAPI 인증키가 설정되어 있지 않습니다.' };
    }

    // 시도별 통계 집계용 맵
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

    // 1. 기존 FESTIVAL 카운팅
    const { data: existingList } = await supabase
      .from('master_places')
      .select('id, address')
      .eq('category', 'FESTIVAL');

    if (existingList) {
      existingList.forEach((item: any) => {
        const addr = item.address || '';
        const region = Object.values(SIDO_CODES).find(r => addr.startsWith(r)) || '기타';
        const stat = statsMap.get(region);
        if (stat) stat.existing_count++;
      });
    }

    // 2. KST 기준 오늘 날짜 (YYYYMMDD)
    const now = new Date();
    const kst = new Date(now.getTime() + 9 * 3600 * 1000);
    const todayStr = kst.toISOString().split('T')[0].replace(/-/g, '');

    const tourUrl = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${tourApiKey}&eventStartDate=${todayStr}&numOfRows=2000&_type=json&MobileOS=ETC&MobileApp=RAONAI`;

    const res = await fetch(tourUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
      }
    });

    if (!res.ok) {
      throw new Error(`TourAPI HTTP ${res.status} error`);
    }

    const tourData: any = await res.json();
    const items = tourData.response?.body?.items?.item || [];
    const festivalList = Array.isArray(items) ? items : (items ? [items] : []);

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
        sido: region !== '기타' ? region : '',
        sigungu: '',
        is_active: true,
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
    if (upsertList.length > 0) {
      const chunkSize = 200;
      for (let i = 0; i < upsertList.length; i += chunkSize) {
        const chunk = upsertList.slice(i, i + chunkSize);
        const { error: upsertErr } = await (supabase.from('master_places') as any)
          .upsert(chunk, { onConflict: 'id' });

        if (upsertErr) {
          throw upsertErr;
        }
        insertedCount += chunk.length;
      }
    }

    // 3. 최종 통계 집계
    const { data: finalFestivalList } = await supabase
      .from('master_places')
      .select('id, address')
      .eq('category', 'FESTIVAL');

    if (finalFestivalList) {
      finalFestivalList.forEach((item: any) => {
        const addr = item.address || '';
        const region = Object.values(SIDO_CODES).find(r => addr.startsWith(r)) || '기타';
        const stat = statsMap.get(region);
        if (stat) stat.final_count++;
      });
    }

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

    // 4. automation_logs 성공 기록
    await (supabase.from('automation_logs') as any).insert({
      job_name: 'WEEKLY_FESTIVAL_SYNC',
      status: 'SUCCESS',
      processed_count: insertedCount,
      message: `주간 축제 정보 동기화 완료: ${insertedCount}건 적재.`,
      duration_ms: executionTime,
      api_status: statsArray,
      created_at: new Date().toISOString()
    });

    revalidatePath('/admin/automation/logs');

    return {
      success: true,
      insertedCount,
      durationMs: executionTime
    };

  } catch (error: any) {
    console.error('[triggerWeeklyFestivalSyncAction] Error:', error);

    try {
      const supabase = createAdminClient();
      await (supabase.from('automation_logs') as any).insert({
        job_name: 'WEEKLY_FESTIVAL_SYNC',
        status: 'FAILURE',
        processed_count: 0,
        message: `축제 동기화 실패: ${error?.message || error}`,
        duration_ms: Date.now() - startTime,
        created_at: new Date().toISOString()
      });
    } catch {}

    return {
      success: false,
      error: error?.message || '동기화 중 오류가 발생했습니다.'
    };
  }
}
