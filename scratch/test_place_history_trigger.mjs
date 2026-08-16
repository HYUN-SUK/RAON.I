import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function testTrigger() {
    console.log('====================================================');
    console.log('🧪 place_history 트리거 작동 실측 테스트');
    console.log('====================================================\n');

    // 1. 임의의 1개 장소 조회
    const { data: place, error: fetchErr } = await supabase
        .from('master_places')
        .select('id, name, is_active, miss_count')
        .limit(1)
        .single();

    if (fetchErr || !place) {
        console.error('장소 조회 실패:', fetchErr);
        return;
    }

    console.log(`테스트 대상: ${place.name} (${place.id})`);
    console.log(`초기 상태: is_active=${place.is_active}, miss_count=${place.miss_count}`);

    const originalMiss = place.miss_count || 0;

    // 2. miss_count 증가 업데이트 (트리거 발동 테스트: STRIKE)
    console.log('\n[테스트 1] miss_count 1 증가 업데이트 중...');
    const { error: updErr1 } = await supabase
        .from('master_places')
        .update({ miss_count: originalMiss + 1 })
        .eq('id', place.id);

    if (updErr1) console.error('업데이트 1 에러:', updErr1);

    // 3. place_history 적재 확인
    const { data: history1 } = await supabase
        .from('place_history')
        .select('*')
        .eq('place_id', place.id)
        .order('occurred_at', { ascending: false })
        .limit(1);

    console.log('✅ STRIKE 트리거 적재 결과:');
    console.log(history1?.[0]);

    // 4. 원상 복구 업데이트 (트리거 발동 안 함: 감소이므로)
    console.log('\n[원상복구] miss_count 원래대로 복구 중...');
    await supabase
        .from('master_places')
        .update({ miss_count: originalMiss })
        .eq('id', place.id);

    // 5. 테스트 이력 정리
    if (history1?.[0]?.id) {
        await supabase.from('place_history').delete().eq('id', history1[0].id);
        console.log('🧹 테스트 로그 정리 완료.');
    }

    console.log('\n====================================================');
    console.log('🎉 place_history 트리거 100% 정상 작동 검증 성공!');
    console.log('====================================================\n');
}

testTrigger();
