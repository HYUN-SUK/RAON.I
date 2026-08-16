import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectDatdonjae() {
    console.log('====================================================');
    console.log('🔍 닷돈재4색야영장 일정 및 날씨 데이터 점검');
    console.log('====================================================\n');

    // 1. user_schedules에서 '닷돈재' 일정 검색
    const { data: scheds } = await supabase
        .from('user_schedules')
        .select('*')
        .ilike('campground_name', '%닷돈재%')
        .limit(5);

    if (scheds && scheds.length > 0) {
        for (const s of scheds) {
            console.log(`일정: ${s.campground_name} (${s.id})`);
            console.log(`체크인: ${s.check_in}, 체크아웃: ${s.check_out}`);
            console.log(`좌표: lat=${s.campground_lat}, lng=${s.campground_lng}`);
            console.log(`스마트플랜 weatherBriefing:`);
            console.log(JSON.stringify(s.smart_plan_data?.weatherBriefing, null, 2));
        }
    } else {
        console.log('닷돈재 일정을 찾을 수 없습니다.');
    }
}

inspectDatdonjae();
