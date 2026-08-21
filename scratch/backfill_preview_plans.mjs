import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function backfillPreviewPlans() {
  console.log('=== [10월 라온아이 예약 일정 맛보기 데이터 일괄 생성 및 동기화] ===\n');

  const { data: schedules, error } = await supabase
    .from('user_schedules')
    .select('*')
    .eq('source', 'raonai')
    .is('smart_plan_data', null)
    .gte('check_in', '2026-10-01');

  if (error) {
    console.error('Error fetching schedules:', error);
    return;
  }

  console.log(`총 ${schedules.length}건의 맛보기 플랜 미생성 일정 발견! 일괄 생성 시작...`);

  for (const s of schedules) {
    try {
      const lat = s.campground_lat || 36.681;
      const lng = s.campground_lng || 126.848;
      const start = new Date(s.check_in);
      const end = new Date(s.check_out);

      // generate preview plan directly via DB places
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

      console.log(`✅ [${s.id}] ${s.campground_name} (${s.check_in}~${s.check_out}) 맛보기 플랜 생성 완료!`);
    } catch (err) {
      console.error(`❌ [${s.id}] 생성 실패:`, err);
    }
  }

  console.log('\n🎉 전체 10월 라온아이 예약 일정 맛보기 데이터 일괄 생성 완료!');
}

backfillPreviewPlans();
