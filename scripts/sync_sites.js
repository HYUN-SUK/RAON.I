require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

// SITES constant from src/constants/sites.ts
const SITES = [
    {
        id: 'site-1',
        name: '철수네',
        description: '숲속 가장 깊은 곳, 조용한 휴식을 위한 프라이빗 사이트입니다.',
        features: ['전기 사용 가능', '파쇄석', '그늘 많음', '프라이빗'],
    },
    {
        id: 'site-2',
        name: '영희네',
        description: '계곡 물소리가 들리는 시원한 명당 자리입니다.',
        features: ['전기 사용 가능', '데크', '계곡 뷰', '편의시설 인접'],
    },
    {
        id: 'site-3',
        name: '민수네',
        description: '모든 것이 준비된 럭셔리 글램핑 사이트입니다.',
        features: ['침대 구비', '개별 화장실', '에어컨', '냉장고'],
    },
    {
        id: 'site-4',
        name: '석이네',
        description: '넓은 주차 공간과 함께하는 오토캠핑 사이트입니다.',
        features: ['차량 진입 가능', '파쇄석', '넓은 공간', '전기 사용 가능'],
    },
    {
        id: 'site-5',
        name: '순이네',
        description: '아이들이 뛰어놀기 좋은 평지 사이트입니다.',
        features: ['잔디', '놀이터 인접', '전기 사용 가능'],
    },
    {
        id: 'site-6',
        name: '옥이네',
        description: '나무 그늘이 풍부한 시원한 사이트입니다.',
        features: ['파쇄석', '그늘 많음', '해먹 설치 가능'],
    },
    {
        id: 'site-7',
        name: '담이네',
        description: '카라반 진입이 가능한 넓은 사이트입니다.',
        features: ['카라반 가능', '전기 30A', '수도 시설'],
    },
    {
        id: 'site-8',
        name: '정이네',
        description: '관리동과 가까워 편리한 사이트입니다.',
        features: ['편의시설 인접', '파쇄석', '와이파이'],
    },
];

async function syncSites() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        console.error('Missing Supabase credentials in .env.local');
        process.exit(1);
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    console.log('Starting site sync...');

    for (const site of SITES) {
        const { error } = await supabase
            .from('sites')
            .update({
                description: site.description,
                features: site.features
            })
            .eq('id', site.id);

        if (error) {
            console.error(`Failed to update ${site.name} (${site.id}):`, error.message);
        } else {
            console.log(`Successfully updated ${site.name} (${site.id})`);
        }
    }

    console.log('Site sync completed!');
}

syncSites();
