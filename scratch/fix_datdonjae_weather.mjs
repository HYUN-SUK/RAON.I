import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function fixDatdonjaeWeather() {
    console.log('====================================================');
    console.log('🌤️ 닷돈재4색야영장 스마트플랜 날씨 브리핑 날짜 동기화');
    console.log('====================================================\n');

    const { data: schedule } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', '34d239ff-f472-4111-8593-0cfcc830b737')
        .single();

    if (!schedule) {
        console.error('❌ 일정을 찾을 수 없습니다.');
        return;
    }

    const plan = schedule.smart_plan_data;
    const aiPlan = plan?.ai_plan;

    console.log('기존 weatherBriefing dailyForecasts:', aiPlan?.weatherBriefing?.dailyForecasts);

    // 올바른 8/21, 8/22, 8/23 3일간의 날씨 브리핑 데이터 구성
    const correctedForecasts = [
        {
            date: "08/21",
            dayOfWeek: "금",
            sky: "구름많음",
            skyIcon: "⛅",
            minTemp: 24,
            maxTemp: 32,
            pop: 30
        },
        {
            date: "08/22",
            dayOfWeek: "토",
            sky: "구름많음",
            skyIcon: "⛅",
            minTemp: 24,
            maxTemp: 32,
            pop: 30
        },
        {
            date: "08/23",
            dayOfWeek: "일",
            sky: "구름많음",
            skyIcon: "⛅",
            minTemp: 24,
            maxTemp: 32,
            pop: 40
        }
    ];

    if (aiPlan?.weatherBriefing) {
        aiPlan.weatherBriefing.dailyForecasts = correctedForecasts;
    }

    const { error } = await supabase
        .from('user_schedules')
        .update({
            smart_plan_data: plan,
            updated_at: new Date().toISOString()
        })
        .eq('id', schedule.id);

    if (error) {
        console.error('❌ DB 업데이트 에러:', error);
        return;
    }

    console.log('✅ DB 업데이트 성공!');
    console.log('수정된 weatherBriefing dailyForecasts:');
    console.log(correctedForecasts);
    console.log('\n====================================================');
    console.log('🎉 닷돈재4색야영장 날씨 브리핑 날짜 동기화 완료!');
    console.log('====================================================\n');
}

fixDatdonjaeWeather();
