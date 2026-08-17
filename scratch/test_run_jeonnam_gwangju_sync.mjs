import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

const SIDO_ALIASES = {
  '전남광주': ['전남광주통합특별시', '전남광주통합시', '전남광주', '전남광주시', '광주전남', '광주광역시', '전라남도', '광주', '전남'],
  '전남광주시': ['전남광주통합특별시', '전남광주통합시', '전남광주', '전남광주시', '광주전남', '광주광역시', '전라남도', '광주', '전남']
};

async function testJeonnamGwangjuCounters() {
    console.log('====================================================');
    console.log('🔍 수정된 aliases 기반 전남광주 카운트 검증');
    console.log('====================================================\n');

    const aliases = SIDO_ALIASES['전남광주시'];

    const sourceToStatKey = {
        'SAFE_RESTAURANT': 'SAFE (안심식당)',
        'LOCALDATA_RESTAURANT_GOOD': 'GOOD (모범음식점)',
        'LOCALDATA_MART_LARGE': 'LARGE_MART (대형마트)',
        'LOCALDATA_MART_OTHER': 'OTHER_MART (기타식품)',
        'TOUR_SPOT': 'SPOT (관광명소)',
        'NMC_HOSPITAL': 'HOSPITAL (병원)'
    };

    for (const [source, label] of Object.entries(sourceToStatKey)) {
        const { count: actCount } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .in('sido', aliases)
            .eq('api_source', source)
            .eq('is_active', true);

        const { count: inactCount } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .in('sido', aliases)
            .eq('api_source', source)
            .eq('is_active', false);

        console.log(`- [${label}] 기존 활성: ${actCount || 0}건 | 비활성: ${inactCount || 0}건 | 합계: ${(actCount || 0) + (inactCount || 0)}건`);
    }
}

testJeonnamGwangjuCounters();
