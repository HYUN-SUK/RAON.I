import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function syncAllToPreview() {
  console.log('=== [8월~10월 라온아이 예약 전체 맛보기 플랜 일괄 동기화 시작] ===\n');

  const todayStr = '2026-08-20';
  const { data: schedules, error } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('source', 'raonai')
    .gte('check_out', todayStr)
    .lte('check_in', '2026-10-31')
    .neq('status', 'cancelled')
    .order('check_in', { ascending: true });

  if (error) {
    console.error('Fetch error:', error);
    return;
  }

  console.log(`총 ${schedules.length}건의 일정 대상 동기화 진행...\n`);

  for (const s of schedules) {
    const lat = s.campground_lat || 36.681;
    const lng = s.campground_lng || 126.848;

    // 카테고리별 1위 장소 추출
    const { data: rawRestaurants } = await supabase.rpc('get_master_places_in_radius_v2', {
      target_lat: lat,
      target_lng: lng,
      radius_meters: 20000,
      limit_count: 50,
      p_category: 'RESTAURANT'
    });

    const { data: rawSpots } = await supabase.rpc('get_master_places_in_radius_v2', {
      target_lat: lat,
      target_lng: lng,
      radius_meters: 20000,
      limit_count: 50,
      p_category: 'SPOT'
    });

    const { data: rawHospitals } = await supabase.rpc('get_master_places_in_radius_v2', {
      target_lat: lat,
      target_lng: lng,
      radius_meters: 20000,
      limit_count: 20,
      p_category: 'HOSPITAL'
    });

    const topRest = (rawRestaurants || [])[0];
    const topSpot = (rawSpots || [])[0];
    const topHosp = (rawHospitals || [])[0];

    const previewPlan = {
      is_preview: true,
      itemListElement: [
        topRest && {
          id: topRest.id,
          category: 'RESTAURANT',
          name: topRest.name,
          placeName: topRest.name,
          address: topRest.address,
          lat: topRest.lat,
          lng: topRest.lng,
          summary: topRest.description || '현지 추천 맛집',
          description: topRest.description || '캠핑장 인근 추천 식당'
        },
        topSpot && {
          id: topSpot.id,
          category: 'SPOT',
          name: topSpot.name,
          placeName: topSpot.name,
          address: topSpot.address,
          lat: topSpot.lat,
          lng: topSpot.lng,
          summary: topSpot.description || '주변 명소/인생샷 스팟',
          description: topSpot.description || '가볼 만한 주변 관광지'
        },
        topHosp && {
          id: topHosp.id,
          category: 'HOSPITAL',
          name: topHosp.name,
          placeName: topHosp.name,
          address: topHosp.address,
          lat: topHosp.lat,
          lng: topHosp.lng,
          summary: topHosp.description || '인근 병원/응급 의료시설',
          description: topHosp.description || '응급 상황 대비 의료기관'
        }
      ].filter(Boolean)
    };

    await supabase
      .from('user_schedules')
      .update({ smart_plan_data: previewPlan })
      .eq('id', s.id);

    console.log(`✅ [${s.id}] ${s.campground_name} (${s.check_in}~${s.check_out}) ➔ ⚡ 순수 맛보기 플랜 동기화 완료!`);
  }

  console.log('\n🎉 8월~10월 전체 21건 라온아이 예약 일정 맛보기 플랜 일괄 동기화 100% 완료!');
}

syncAllToPreview();
