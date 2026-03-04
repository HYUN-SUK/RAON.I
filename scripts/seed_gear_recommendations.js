const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY
);

const gearData = [
    {
        title: "튼튼한 우의와 여분 팩",
        description: "비 소식이 있습니다. 활동성을 위해 판초 우의를 챙기시고, 타프를 고정할 팩을 넉넉히 준비하세요.",
        category: "play",
        tags: ["#gear", "#비오는날", "#우중캠핑"],
        servings: "공통",
        metadata: { type: "essential" }
    },
    {
        title: "방수포(그라운드시트)",
        description: "비가 오면 바닥에서 습기가 올라오고 텐트가 오염되기 쉽습니다. 텐트 크기에 맞는 방수포를 꼭 챙기세요.",
        category: "play",
        tags: ["#gear", "#비오는날", "#우중캠핑"],
        servings: "공통",
        metadata: { type: "essential" }
    },
    {
        title: "동계용 침낭과 두꺼운 매트",
        description: "밤 기온이 많이 랭합니다. 한기 차단을 위해 두꺼운 발포/에어 매트와 동계용 침낭을 준비하세요.",
        category: "play",
        tags: ["#gear", "#추운날", "#겨울", "#동계캠핑"],
        servings: "개인별",
        metadata: { type: "warmth" }
    },
    {
        title: "핫팩과 탕파(유단포)",
        description: "취침 전 침낭 안에 핫팩이나 뜨거운 물을 넣은 탕파를 미리 넣어두면 아주 따뜻하게 주무실 수 있습니다.",
        category: "play",
        tags: ["#gear", "#추운날", "#겨울"],
        servings: "개인별",
        metadata: { type: "warmth" }
    },
    {
        title: "일산화탄소 경보기",
        description: "난로 사용 시 일산화탄소 경보기는 필수 생존 장비입니다. 반드시 작동 여부를 테스트 후 가져오세요.",
        category: "play",
        tags: ["#gear", "#추운날", "#겨울", "#난로"],
        servings: "텐트당 1개",
        metadata: { type: "safety" }
    },
    {
        title: "써큘레이터 (선풍기)",
        description: "무더운 날씨입니다. 원활한 환기와 시원함을 위해 써큘레이터를 챙기시고 건전지 상태를 확인하세요.",
        category: "play",
        tags: ["#gear", "#더운날", "#여름", "#폭염"],
        servings: "조별",
        metadata: { type: "cooling" }
    },
    {
        title: "아이스박스와 보냉제",
        description: "기온이 높을 때는 식재료가 상하기 쉽습니다. 성능 좋은 아이스박스와 넉넉한 보냉제를 준비하세요.",
        category: "play",
        tags: ["#gear", "#더운날", "#여름"],
        servings: "조별",
        metadata: { type: "food_safety" }
    },
    {
        title: "미니 타프 (햇빛 차단용)",
        description: "뜨거운 햇살을 피할 수 있는 그늘막이 필수입니다. 설치와 해체가 간편한 타프를 준비하시면 좋습니다.",
        category: "play",
        tags: ["#gear", "#맑음", "#더운날", "#여름"],
        servings: "조별",
        metadata: { type: "shade" }
    },
    {
        title: "바람막이 점퍼",
        description: "새벽녘에는 기온이 떨어집니다. 일교차에 대비해 가볍게 걸칠 수 있는 바람막이를 챙기세요.",
        category: "play",
        tags: ["#gear", "#맑음", "#일교차", "#간절기", "#추운날"],
        servings: "개인별",
        metadata: { type: "clothing" }
    },
    {
        title: "감성 랜턴과 화로대",
        description: "날씨가 맑아서 별을 보거나 불멍하기 딱 좋은 날입니다. 화로대와 감성 랜턴을 챙겨보세요.",
        category: "play",
        tags: ["#gear", "#맑음", "#감성", "#불멍"],
        servings: "조별",
        metadata: { type: "mood" }
    }
];

async function seedGearData() {
    console.log(`[Seed] Inserting ${gearData.length} gear recommendations...`);
    const { data, error } = await supabase
        .from('recommendation_pool')
        .insert(gearData)
        .select('title');

    if (error) {
        console.error("Failed to insert gear logic:", error);
    } else {
        console.log(`Successfully inserted ${data.length} gear items!`);
    }
}

seedGearData();
