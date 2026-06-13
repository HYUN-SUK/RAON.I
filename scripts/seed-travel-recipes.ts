import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error("Missing Supabase configuration. Please check .env.local");
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// 1. Categories Definition
const CATEGORY_TREE = [
    {
        name: "🔥 바베큐/그릴",
        icon_emoji: "🔥",
        sort_order: 1,
        children: [
            { name: "소/돼지", sort_order: 1 },
            { name: "닭/오리", sort_order: 2 },
            { name: "해산물", sort_order: 3 },
            { name: "꼬치/기타", sort_order: 4 }
        ]
    },
    {
        name: "🍳 원팬/간단",
        icon_emoji: "🍳",
        sort_order: 2,
        children: [
            { name: "면/파스타", sort_order: 1 },
            { name: "볶음/덮밥", sort_order: 2 },
            { name: "전/부침", sort_order: 3 },
            { name: "기타간단요리", sort_order: 4 }
        ]
    },
    {
        name: "🥘 국물/밀키트",
        icon_emoji: "🥘",
        sort_order: 3,
        children: [
            { name: "찌개/전골", sort_order: 1 },
            { name: "탕/어묵탕", sort_order: 2 }
        ]
    },
    {
        name: "🥗 아침/브런치",
        icon_emoji: "🥗",
        sort_order: 4,
        children: [
            { name: "샌드위치/토스트", sort_order: 1 },
            { name: "샐러드/과일", sort_order: 2 },
            { name: "죽/누룽지", sort_order: 3 }
        ]
    },
    {
        name: "🍹 파티/스낵",
        icon_emoji: "🍹",
        sort_order: 5,
        children: [
            { name: "핑거푸드/치즈", sort_order: 1 },
            { name: "튀김/마른안주", sort_order: 2 }
        ]
    }
];

// Recipe Pool (150+ Items)
const RECIPE_POOL = [
    // --- 1. 바베큐/그릴 - 소/돼지 ---
    {
        name: "한돈 숯불 삼겹살 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "삼겹살(두께 2cm 내외)", amount: "600g" },
            { name: "허브솔트", amount: "약간" },
            { name: "쌈채소(상추, 깻잎)", amount: "적당량" },
            { name: "쌈장", amount: "1통" }
        ],
        travel_tips: [
            "숯불에 기름이 떨어지면 불쇼가 날 수 있으니 삼겹살은 직화보다 은은한 사이드 불에서 굽는 것이 좋습니다.",
            "고기는 굽기 30분 전에 냉장고에서 꺼내 상온에 두어야 골고루 익습니다."
        ],
        youtube_search_keyword: "캠핑 삼겹살 맛있게 굽는법",
        instagram_search_keyword: "캠핑삼겹살"
    },
    {
        name: "목살 참숯 스테이크",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "돼지 목살(두툼하게)", amount: "600g" },
            { name: "로즈마리", amount: "2줄기" },
            { name: "버터", amount: "1큰술" },
            { name: "마늘", amount: "5알" }
        ],
        travel_tips: [
            "목살은 기름이 적어 직화 구이에 가장 적합한 고기입니다. 겉면을 강하게 익혀 육즙을 가두세요.",
            "다 구운 목살은 호일에 감싸 5분간 레스팅하면 고기가 아주 부드러워집니다."
        ],
        youtube_search_keyword: "캠핑 목살 스테이크 레스팅",
        instagram_search_keyword: "목살바베큐"
    },
    {
        name: "양숄더랙 로즈마리 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "양 숄더랙", amount: "500g" },
            { name: "쯔란/시즈닝 가루", amount: "적당량" },
            { name: "올리브유", amount: "2큰술" },
            { name: "통마늘", amount: "10알" }
        ],
        travel_tips: [
            "양고기는 특유의 향이 있으므로 굽기 전 허브솔트와 올리브유, 로즈마리로 마리네이드하는 것이 필수입니다.",
            "고소한 지방 부위가 숯불 쪽을 향하게 하여 겉을 바삭하게 구우면 풍미가 배가됩니다."
        ],
        youtube_search_keyword: "캠핑 양갈비 굽기 쯔란",
        instagram_search_keyword: "캠핑양갈비"
    },
    {
        name: "우삼겹 숙주 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "우삼겹", amount: "300g" },
            { name: "숙주나물", amount: "1봉지" },
            { name: "굴소스", amount: "1.5큰술" },
            { name: "대파", amount: "1/2대" }
        ],
        travel_tips: [
            "그리들이나 구이바다를 강불로 예열한 후 우삼겹을 빠르게 볶아내고, 숙주는 마지막에 넣어 30초만 볶아 아삭함을 살리세요.",
            "와사비 간장 소스를 곁들이면 기름진 맛을 개운하게 잡아줍니다."
        ],
        youtube_search_keyword: "우삼겹 숙주볶음 그리들 요리",
        instagram_search_keyword: "우삼겹숙주볶음"
    },
    {
        name: "수비드 돈마호크 그리들 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "돈마호크(뼈등심)", amount: "1대" },
            { name: "몬트리올 스테이크 시즈닝", amount: "1큰술" },
            { name: "올리브유", amount: "3큰술" },
            { name: "가니쉬용 방울토마토", amount: "5개" }
        ],
        travel_tips: [
            "두께가 있는 돈마호크는 그리들 위에서 버터를 끼얹어가며 약불로 천천히 속까지 익혀주어야 퍽퍽하지 않습니다.",
            "뼈 주위는 가위로 칼집을 깊게 내주어 핏물이 맺히지 않게 하세요."
        ],
        youtube_search_keyword: "돈마호크 캠핑 요리 굽기",
        instagram_search_keyword: "돈마호크구이"
    },
    {
        name: "토마호크 버터 아로제 스테이크",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "토마호크 스테이크", amount: "800g" },
            { name: "무염 버터", amount: "50g" },
            { name: "통마늘", amount: "6알" },
            { name: "아스파라거스", amount: "4대" }
        ],
        travel_tips: [
            "고기 두께가 두껍기 때문에 굽기 최소 1시간 전에 시즈닝을 해 두고, 구울 때는 버터를 녹여 고기 표면에 계속 끼얹어(아로제) 줍니다.",
            "심부온도계가 있다면 내부 온도가 54도 정도 되었을 때 불에서 꺼내 레스팅하는 것이 가장 맛있습니다."
        ],
        youtube_search_keyword: "토마호크 아로제 스테이크 캠핑",
        instagram_search_keyword: "캠핑토마호크"
    },
    {
        name: "돼지갈비 숯불 양념 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "양념 돼지갈비", amount: "600g" },
            { name: "통마늘", amount: "10알" },
            { name: "가래떡", amount: "2개" }
        ],
        travel_tips: [
            "양념 갈비는 타기 쉬우므로 자주 뒤집어가며 숯불의 훈연 열기로 구워야 속까지 완벽히 익습니다.",
            "호일로 그릴의 반을 가려 간접 열로 구운 다음 마지막에 직화로 불향을 살짝 입혀주세요."
        ],
        youtube_search_keyword: "캠핑 돼지갈비 타지않게 굽기",
        instagram_search_keyword: "숯불돼지갈비"
    },
    {
        name: "수제 대패삼겹 미나리 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "대패삼겹살", amount: "400g" },
            { name: "한재 미나리", amount: "1단" },
            { name: "초고추장", amount: "2큰술" },
            { name: "허브솔트", amount: "적당량" }
        ],
        travel_tips: [
            "대패삼겹을 그리들에 굽다가 흘러나온 돼지기름에 미나리를 통째로 올려 살짝 숨만 죽여 싸 드시면 꿀맛입니다.",
            "미나리는 향이 날아가지 않도록 고기가 거의 다 익었을 때 불을 끄기 직전 얹어주세요."
        ],
        youtube_search_keyword: "대패삼겹살 미나리 구이 캠핑",
        instagram_search_keyword: "미나리삼겹살"
    },
    {
        name: "LA갈비 석쇠 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "LA 갈비(양념육)", amount: "500g" },
            { name: "새송이버섯", amount: "1개" }
        ],
        travel_tips: [
            "석쇠에 구울 때는 양념이 눌어붙지 않도록 석쇠에 미리 식용유를 발라두는 것이 좋습니다.",
            "고기가 얇으므로 강한 불에서 빠르게 굽는 것이 부드러운 육질을 유지하는 비결입니다."
        ],
        youtube_search_keyword: "캠핑 LA갈비 석쇠 직화구이",
        instagram_search_keyword: "LA갈비구이"
    },
    {
        name: "돼지 껍데기 쫀득 벌집 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "소/돼지",
        ingredients: [
            { name: "벌집 돼지껍데기", amount: "300g" },
            { name: "콩가루", amount: "3큰술" },
            { name: "빨간 양념 소스", amount: "2큰술" }
        ],
        travel_tips: [
            "껍데기는 구울 때 사방으로 튈 수 있으므로 그리들이나 무거운 누름돌(혹은 집게)로 꾹 누르며 구워야 안전하고 바삭합니다.",
            "구운 직후 바로 콩가루에 찍어 먹으면 겉바속촉 고소함이 일품입니다."
        ],
        youtube_search_keyword: "벌집 돼지껍데기 굽는 꿀팁",
        instagram_search_keyword: "돼지껍데기구이"
    },

    // --- 2. 바베큐/그릴 - 닭/오리 ---
    {
        name: "춘천식 숯불 닭갈비",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "닭/오리",
        ingredients: [
            { name: "닭다리살(양념육)", amount: "500g" },
            { name: "떡사리", amount: "10개" },
            { name: "양배추", amount: "1/8통" }
        ],
        travel_tips: [
            "닭 정육은 껍질 부위부터 석쇠에 올려 구워야 기름이 스며나와 들러붙지 않고 바삭해집니다.",
            "양념 닭다리살은 쉽게 타므로 은은한 불에서 자주 뒤집어가며 조리하세요."
        ],
        youtube_search_keyword: "캠핑 춘천 숯불 닭갈비 굽기",
        instagram_search_keyword: "숯불닭갈비"
    },
    {
        name: "오리 로스 허브 소금 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "닭/오리",
        ingredients: [
            { name: "생오리 슬라이스", amount: "500g" },
            { name: "부추", amount: "1/2단" },
            { name: "팽이버섯", amount: "1봉지" },
            { name: "머스타드 소스", amount: "2큰술" }
        ],
        travel_tips: [
            "오리에서 나오는 풍부한 기름에 부추와 버섯을 함께 볶아 드시면 풍미가 한층 깊어집니다.",
            "부추는 숨이 너무 죽지 않도록 오리가 다 구워졌을 때 마지막에 섞어주세요."
        ],
        youtube_search_keyword: "캠핑 오리로스 구이 부추 무침",
        instagram_search_keyword: "오리로스구이"
    },
    {
        name: "훈제오리 단호박 치즈 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "닭/오리",
        ingredients: [
            { name: "훈제오리 슬라이스", amount: "400g" },
            { name: "미니 단호박", amount: "1개" },
            { name: "모짜렐라 치즈", amount: "100g" }
        ],
        travel_tips: [
            "단호박 속을 파내어 볶은 훈제오리와 치즈를 채우고, 호일에 감싸 숯불 잔불에 15분간 구워주면 멋진 파티 요리가 완성됩니다.",
            "단호박은 전자레인지가 있다면 3분 정도 미리 돌려오면 조리 시간이 대폭 단축됩니다."
        ],
        youtube_search_keyword: "캠핑 단호박 훈제오리 치즈구이",
        instagram_search_keyword: "단호박훈제오리구이"
    },
    {
        name: "닭가슴살 꼬치 버터 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "닭/오리",
        ingredients: [
            { name: "닭가슴살 또는 안심", amount: "300g" },
            { name: "대파", amount: "2대" },
            { name: "버터", amount: "20g" },
            { name: "데리야끼 소스", amount: "3큰술" }
        ],
        travel_tips: [
            "닭고기와 대파를 번갈아 꼬치에 꿴 뒤, 녹인 버터를 솔로 발라가며 그릴에서 천천히 구워 데리야끼 소스를 덧발라 줍니다.",
            "안심 부위를 사용하면 가슴살보다 훨씬 퍽퍽하지 않고 부드럽습니다."
        ],
        youtube_search_keyword: "대파 닭꼬치 데리야끼 구이 캠핑",
        instagram_search_keyword: "수제닭꼬치"
    },
    {
        name: "통닭 맥주캔 비어캔치킨",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "닭/오리",
        ingredients: [
            { name: "생닭(10호)", amount: "1마리" },
            { name: "캔맥주(355ml)", amount: "1캔" },
            { name: "올리브유", amount: "2큰술" },
            { name: "바베큐 럽(시즈닝)", amount: "2큰술" }
        ],
        travel_tips: [
            "생닭의 항문 쪽에 맥주캔을 끼우고, 웨버 그릴 등 뚜껑이 있는 바베큐 그릴에서 간접열로 1시간 20분 동안 훈제합니다.",
            "맥주가 끓으면서 닭의 속살을 스팀 처리해 주어 닭가슴살까지 놀라울 정도로 촉촉해집니다."
        ],
        youtube_search_keyword: "비어캔치킨 만드는법 캠핑 요리",
        instagram_search_keyword: "비어캔치킨"
    },

    // --- 3. 바베큐/그릴 - 해산물 ---
    {
        name: "블랙타이거 쉬림프 대하 소금구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "해산물",
        ingredients: [
            { name: "대하 또는 블랙타이거 새우", amount: "10-15마리" },
            { name: "굵은 소금", amount: "1봉지" },
            { name: "버터", amount: "10g" }
        ],
        travel_tips: [
            "직화용 알루미늄 팬에 소금을 도톰하게 깔고 새우를 올려 빨갛게 변할 때까지 구워주면 소금이 수분을 잡아주어 통통하게 익습니다.",
            "새우 머리는 따로 잘라내어 버터를 넣고 약불에 바삭하게 구워 드시면 별미입니다."
        ],
        youtube_search_keyword: "대하 소금구이 새우 버터구이 캠핑",
        instagram_search_keyword: "새우소금구이"
    },
    {
        name: "참숯 민물장어 데리야끼 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "해산물",
        ingredients: [
            { name: "손질 민물장어", amount: "1kg" },
            { name: "데리야끼 소스", amount: "1통" },
            { name: "생강 슬라이스", amount: "적당량" },
            { name: "굵은 소금", amount: "약간" }
        ],
        travel_tips: [
            "장어는 껍질 부위부터 소금을 뿌려 굽고, 살 쪽이 노릇해지면 데리야끼 소스를 붓으로 여러 번 덧발라 타지 않게 굽습니다.",
            "구울 때 장어가 굽어지지 않도록 석쇠 사이 단단히 끼우거나 꼬치를 꽂아 고정하면 모양이 이쁩니다."
        ],
        youtube_search_keyword: "캠핑 장어구이 양념 타지않게 굽기",
        instagram_search_keyword: "숯불장어구이"
    },
    {
        name: "가리비 치즈 초장 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "해산물",
        ingredients: [
            { name: "가리비", amount: "1kg" },
            { name: "모짜렐라 치즈", amount: "150g" },
            { name: "초고추장", amount: "3큰술" },
            { name: "청양고추", amount: "1개" }
        ],
        travel_tips: [
            "숯불 위에 가리비를 올려 껍질이 벌어지면 빈 껍질을 떼어내고, 살 위에 초장과 치즈, 다진 청양고추를 올려 녹여 드세요.",
            "구우면서 조개 입이 벌어질 때 뜨거운 조갯물이 튈 수 있으니 장갑을 필수로 착용하세요."
        ],
        youtube_search_keyword: "가리비 치즈 구이 캠핑 조개구이",
        instagram_search_keyword: "가리비치즈구이"
    },
    {
        name: "버터 통오징어 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "해산물",
        ingredients: [
            { name: "손질 통오징어", amount: "1마리" },
            { name: "버터", amount: "20g" },
            { name: "설탕", amount: "1작은술" },
            { name: "파슬리가루", amount: "약간" }
        ],
        travel_tips: [
            "오징어 몸통 양쪽에 칼집을 내어 버터를 녹인 팬이나 석쇠에 구우면 모양이 둥글게 꼬이지 않고 고르게 익습니다.",
            "마지막에 마요네즈와 간장, 청양고추를 섞은 소스에 찍어 드시면 맥주 안주로 최고입니다."
        ],
        youtube_search_keyword: "오징어 버터구이 맥주 안주 캠핑",
        instagram_search_keyword: "버터오징어구이"
    },
    {
        name: "은호일 연어 허브 스테이크",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "해산물",
        ingredients: [
            { name: "연어 필렛", amount: "300g" },
            { name: "레몬", amount: "1/2개" },
            { name: "올리브유", amount: "1큰술" },
            { name: "아스파라거스", amount: "3대" }
        ],
        travel_tips: [
            "은박 호일에 연어, 올리브유, 허브솔트, 레몬 슬라이스를 넣고 꽁꽁 감싸서 석쇠 위에서 스팀 방식으로 익히면 살이 아주 부드럽습니다.",
            "그릴 뚜껑을 덮어 열기를 순환시키면 뒤집지 않고도 골고루 익습니다."
        ],
        youtube_search_keyword: "캠핑 연어 파피요트 호일 구이",
        instagram_search_keyword: "연어스테이크"
    },

    // --- 4. 바베큐/그릴 - 꼬치/기타 ---
    {
        name: "모듬 소시지 야채 꼬치",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "꼬치/기타",
        ingredients: [
            { name: "캠핑용 모듬 소시지", amount: "1팩" },
            { name: "파프리카", amount: "1개" },
            { name: "새송이버섯", amount: "1개" },
            { name: "꼬치용 나무꼬챙이", amount: "적당량" }
        ],
        travel_tips: [
            "나무꼬챙이를 물에 10분 정도 담가두었다가 꽂으면 숯불 위에서 꼬챙이가 쉽게 타서 부러지는 것을 막을 수 있습니다.",
            "소시지에 촘촘히 칼집을 내야 구울 때 터지지 않고 불향이 깊게 뱁니다."
        ],
        youtube_search_keyword: "캠핑 소시지 야채 꼬치 굽기",
        instagram_search_keyword: "소시지꼬치구이"
    },
    {
        name: "그리들 양꼬치 구이",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "꼬치/기타",
        ingredients: [
            { name: "양꼬치(반제품)", amount: "10대" },
            { name: "쯔란", amount: "2큰술" },
            { name: "식용유", amount: "1큰술" }
        ],
        travel_tips: [
            "그리들에 양꼬치를 올려 기름을 빼가며 튀기듯 굽습니다. 숯불이 없어도 그리들 위에서 훌륭한 양꼬치 맛을 낼 수 있습니다.",
            "기름이 튈 수 있으니 키친타올을 미리 준비해 닦아주면서 조리하세요."
        ],
        youtube_search_keyword: "그리들 양꼬치 굽는법 캠핑",
        instagram_search_keyword: "캠핑양꼬치"
    },
    {
        name: "캠핑 마시멜로 초코 꼬치",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "꼬치/기타",
        ingredients: [
            { name: "마시멜로", amount: "1봉지" },
            { name: "다이제 또는 비스킷", amount: "1봉지" },
            { name: "판초콜릿", amount: "1개" }
        ],
        travel_tips: [
            "숯불 잔불 위에서 마시멜로를 천천히 돌려가며 황금빛이 나도록 구워 다이제 비스킷 사이에 초콜릿과 함께 끼워 샌드로 만들어 드세요(스모어).",
            "직화에 직접 대면 마시멜로가 타서 불이 붙을 수 있으니 불꽃에서 10cm 정도 거리를 두고 열기로만 구우세요."
        ],
        youtube_search_keyword: "캠핑 스모어 마시멜로 굽는법",
        instagram_search_keyword: "마시멜로구이"
    },
    {
        name: "모듬 어묵 베이컨 꼬치",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "꼬치/기타",
        ingredients: [
            { name: "베이컨", amount: "1팩" },
            { name: "꼬치용 어묵", amount: "1팩" },
            { name: "떡볶이 떡", amount: "10개" }
        ],
        travel_tips: [
            "떡을 베이컨으로 말아 꼬치에 꿰어 굽거나 어묵을 엮어 구우면 짭조름한 베이컨 기름이 떡과 어묵에 배어 훌륭한 맥주 안주가 됩니다.",
            "마지막에 허니머스타드나 칠리소스를 얇게 뿌려 마무리하세요."
        ],
        youtube_search_keyword: "베이컨 떡꼬치 캠핑 안주",
        instagram_search_keyword: "베이컨떡꼬치"
    },
    {
        name: "모듬 야채 구이 (아스파라거스/버섯/토마토)",
        parentCategory: "🔥 바베큐/그릴",
        childCategory: "꼬치/기타",
        ingredients: [
            { name: "아스파라거스", amount: "5대" },
            { name: "통새송이버섯", amount: "2개" },
            { name: "방울토마토", amount: "10개" },
            { name: "올리브유", amount: "1큰술" }
        ],
        travel_tips: [
            "새송이버섯은 썰지 말고 '통째로' 굴려가며 구운 뒤 마지막에 썰어야 버섯 안의 촉촉한 즙이 마르지 않고 고스란히 남아있습니다.",
            "구운 방울토마토는 뜨거우니 입을 데지 않도록 식혀서 드세요."
        ],
        youtube_search_keyword: "캠핑 야채 구이 새송이버섯 통구이",
        instagram_search_keyword: "가니쉬구이"
    },

    // --- 5. 원팬/간단 - 면/파스타 ---
    {
        name: "초간단 베이컨 마늘 알리오 올리오",
        parentCategory: "🍳 원팬/간단",
        childCategory: "면/파스타",
        ingredients: [
            { name: "파스타 면", amount: "2인분" },
            { name: "마늘", amount: "10알" },
            { name: "페페론치노", amount: "5개" },
            { name: "베이컨", amount: "4줄" },
            { name: "올리브유", amount: "1/2컵" }
        ],
        travel_tips: [
            "마늘은 편으로 썰고 약불의 올리브유에서 노릇해질 때까지 천천히 향을 우려내야 소스가 맛있어집니다.",
            "면을 끓인 면수를 한 국자 남겨두었다가 오일 소스와 섞어주면 오일과 물이 유화되어 크리미한 소스가 됩니다."
        ],
        youtube_search_keyword: "캠핑 원팬 알리오올리오 파스타",
        instagram_search_keyword: "알리오올리오파스타"
    },
    {
        name: "토마토 미트볼 치즈 파스타",
        parentCategory: "🍳 원팬/간단",
        childCategory: "면/파스타",
        ingredients: [
            { name: "파스타 면", amount: "2인분" },
            { name: "시판 토마토 소스", amount: "1병" },
            { name: "3분 미트볼", amount: "1팩" },
            { name: "눈꽃 모짜렐라 치즈", amount: "100g" }
        ],
        travel_tips: [
            "캠핑이나 펜션에서는 미트볼 레토르트 팩을 활용하면 고기를 갈아 넣는 복잡한 과정 없이 미트 소스 맛을 낼 수 있습니다.",
            "소스를 버무린 후 치즈를 뿌리고 프라이팬 뚜껑을 닫아 잔열로 치즈를 녹이세요."
        ],
        youtube_search_keyword: "캠핑 미트볼 토마토 파스타 초간단",
        instagram_search_keyword: "토마토미트볼파스타"
    },
    {
        name: "꽃게 한 마리 해물라면",
        parentCategory: "🍳 원팬/간단",
        childCategory: "면/파스타",
        ingredients: [
            { name: "라면", amount: "2봉지" },
            { name: "냉동 꽃게(손질)", amount: "1마리" },
            { name: "청양고추", amount: "1개" },
            { name: "대파", amount: "1/2대" }
        ],
        travel_tips: [
            "물이 끓을 때 꽃게를 먼저 넣고 3분간 끓여 해물 육수를 충분히 우려낸 다음 스프와 면을 넣어야 국물 맛이 깊어집니다.",
            "마지막에 고춧가루 반 큰술을 추가하면 파는 해물라면의 비주얼과 칼칼함을 연출할 수 있습니다."
        ],
        youtube_search_keyword: "캠핑 꽃게 해물라면 해장라면",
        instagram_search_keyword: "해물라면"
    },
    {
        name: "투움바 신라면 (우유/치즈)",
        parentCategory: "🍳 원팬/간단",
        childCategory: "면/파스타",
        ingredients: [
            { name: "신라면", amount: "1봉지" },
            { name: "우유", amount: "250ml" },
            { name: "체다 슬라이스 치즈", amount: "1장" },
            { name: "베이컨", amount: "2줄" },
            { name: "편마늘", amount: "3알" }
        ],
        travel_tips: [
            "마늘과 베이컨을 볶다가 우유를 붓고 끓으면 스프(반 봉지만)와 면을 넣어 졸이듯 끓인 후 치즈로 마무리합니다.",
            "스프를 다 넣으면 짤 수 있으므로 반드시 반 봉지만 넣고 입맛에 따라 가감하세요."
        ],
        youtube_search_keyword: "신라면 투움바 파스타 황금레시피",
        instagram_search_keyword: "투움바라면"
    },
    {
        name: "스팸 오뎅 우동",
        parentCategory: "🍳 원팬/간단",
        childCategory: "면/파스타",
        ingredients: [
            { name: "우동 사리", amount: "1개" },
            { name: "스팸", amount: "1/4캔" },
            { name: "꼬치 사각어묵", amount: "2개" },
            { name: "가쓰오부시 장국(쯔유)", amount: "3큰술" }
        ],
        travel_tips: [
            "물 500ml에 쯔유로 간을 맞춘 뒤 얇게 썬 스팸과 사각어묵을 우려내며 끓인 후 면을 넣으면 이자카야 감성의 국물 요리가 완성됩니다.",
            "스팸을 뜨거운 물에 한번 헹궈 기름을 빼면 더 담백한 국물이 됩니다."
        ],
        youtube_search_keyword: "스팸 오뎅 우동 캠핑 요리",
        instagram_search_keyword: "오뎅우동"
    },

    // --- 6. 원팬/간단 - 볶음/덮밥 ---
    {
        name: "베이컨 굴소스 김치볶음밥",
        parentCategory: "🍳 원팬/간단",
        childCategory: "볶음/덮밥",
        ingredients: [
            { name: "신김치", amount: "1컵" },
            { name: "베이컨", amount: "3줄" },
            { name: "즉석밥", amount: "2공기" },
            { name: "굴소스", amount: "1/2큰술" },
            { name: "달걀", amount: "2개" }
        ],
        travel_tips: [
            "베이컨에서 기름이 충분히 나올 때까지 구운 뒤 김치를 넣어 볶고, 즉석밥은 데우지 않은 차가운 상태로 넣어야 밥알이 고슬고슬해집니다.",
            "마지막에 그리들 주변에 계란물을 둘러주면 보기 좋은 캠핑 비주얼이 연출됩니다."
        ],
        youtube_search_keyword: "캠핑 김치볶음밥 그리들 계란 크러스트",
        instagram_search_keyword: "캠핑김치볶음밥"
    },
    {
        name: "스팸 마요 덮밥",
        parentCategory: "🍳 원팬/간단",
        childCategory: "볶음/덮밥",
        ingredients: [
            { name: "스팸", amount: "1/2캔" },
            { name: "달걀", amount: "2개" },
            { name: "즉석밥", amount: "2공기" },
            { name: "마요네즈", amount: "2큰술" },
            { name: "돈까스소스 또는 간장", amount: "1.5큰술" }
        ],
        travel_tips: [
            "스팸은 깍둑썰기하여 기름 없이 노릇하게 굽고, 계란은 따로 스크램블하여 밥 위에 얹은 후 소스를 뿌려 비벼 먹습니다.",
            "소스가 없다면 간장 1큰술과 설탕 반 큰술을 섞어 전자레인지에 살짝 돌려 사용하면 됩니다."
        ],
        youtube_search_keyword: "스팸마요덮밥 초간단 여행 레시피",
        instagram_search_keyword: "스팸마요덮밥"
    },
    {
        name: "대패삼겹살 숙주 볶음",
        parentCategory: "🍳 원팬/간단",
        childCategory: "볶음/덮밥",
        ingredients: [
            { name: "대패삼겹살", amount: "300g" },
            { name: "숙주나물", amount: "1봉지" },
            { name: "굴소스", amount: "1.5큰술" },
            { name: "다진 마늘", amount: "1큰술" }
        ],
        travel_tips: [
            "마늘을 먼저 볶아 향을 낸 후 삼겹살을 완전히 익히고, 마지막에 숙주와 굴소스를 넣고 센 불에서 1분만 볶아야 물이 생기지 않습니다.",
            "취향에 따라 페페론치노를 부수어 넣으면 칼칼함이 더해집니다."
        ],
        youtube_search_keyword: "대패삼겹 숙주볶음 이자카야 캠핑안주",
        instagram_search_keyword: "대패삼겹살숙주볶음"
    },
    {
        name: "매콤 제육 덮밥",
        parentCategory: "🍳 원팬/간단",
        childCategory: "볶음/덮밥",
        ingredients: [
            { name: "돼지 앞다리살(불고기용)", amount: "400g" },
            { name: "시판 제육양념", amount: "3큰술" },
            { name: "양파", amount: "1/2개" },
            { name: "즉석밥", amount: "2공기" }
        ],
        travel_tips: [
            "캠핑이나 여행지에서는 양념을 직접 계량하기보다 시판 제육 소스나 양념된 고기를 마트에서 구매해 볶는 것이 실패를 방지하는 지름길입니다.",
            "양파와 파는 아삭한 식감을 원하시면 고기가 반쯤 익었을 때 추가하세요."
        ],
        youtube_search_keyword: "제육볶음 그리들 초간단 캠핑 요리",
        instagram_search_keyword: "제육덮밥"
    },
    {
        name: "소고기 소보로 덮밥",
        parentCategory: "🍳 원팬/간단",
        childCategory: "볶음/덮밥",
        ingredients: [
            { name: "다진 소고기", amount: "200g" },
            { name: "간장", amount: "2큰술" },
            { name: "설탕", amount: "1큰술" },
            { name: "달걀", amount: "2개" },
            { name: "즉석밥", amount: "2공기" }
        ],
        travel_tips: [
            "다진 소고기를 간장, 설탕, 맛술로 볶아 둔 뒤, 프라이팬의 한쪽에 계란 스크램블을 만들어 밥 위에 절반씩 예쁘게 올려 덮밥을 완성합니다.",
            "아이들이 있는 가족 여행에서 달콤 짭조름하게 한 그릇 해결하기 좋습니다."
        ],
        youtube_search_keyword: "소고기 소보로 덮밥 아이들 한끼",
        instagram_search_keyword: "소보로덮밥"
    },

    // --- 7. 원팬/간단 - 전/부침 ---
    {
        name: "김치전 깡통햄 송송 부침",
        parentCategory: "🍳 원팬/간단",
        childCategory: "전/부침",
        ingredients: [
            { name: "김치", amount: "1/2컵" },
            { name: "부침가루", amount: "1컵" },
            { name: "스팸 또는 참치캔", amount: "1/2캔" },
            { name: "찬물", amount: "3/4컵" }
        ],
        travel_tips: [
            "바삭한 김치전을 만들려면 반죽을 섞을 때 반드시 찬물(얼음물이면 더 좋음)을 사용하고 숟가락으로 살살 섞어 글루텐 형성을 억제해야 합니다.",
            "스팸을 숟가락으로 으깨어 반죽에 섞으면 고기를 넣은 것처럼 씹는 맛과 감칠맛이 살아납니다."
        ],
        youtube_search_keyword: "바삭한 김치전 황금레시피 캠핑",
        instagram_search_keyword: "스팸김치전"
    },
    {
        name: "치즈 베이컨 감자채전",
        parentCategory: "🍳 원팬/간단",
        childCategory: "전/부침",
        ingredients: [
            { name: "감자", amount: "2개" },
            { name: "베이컨", amount: "3줄" },
            { name: "모짜렐라 치즈", amount: "80g" },
            { name: "부침가루", amount: "2큰술" }
        ],
        travel_tips: [
            "감자는 칼로 최대한 얇게 채썰고 물에 헹구지 않고 전분을 그대로 살려 베이컨과 섞어 노릇하게 부쳐내면 식감이 바삭합니다.",
            "한 면이 바삭하게 익으면 뒤집고 그 위에 치즈를 듬뿍 얹어 반으로 접어 녹이세요."
        ],
        youtube_search_keyword: "감자채전 치즈 베이컨 백종원 레시피",
        instagram_search_keyword: "치즈감자채전"
    },
    {
        name: "해물 모듬 파전",
        parentCategory: "🍳 원팬/간단",
        childCategory: "전/부침",
        ingredients: [
            { name: "실파 또는 쪽파", amount: "1단" },
            { name: "냉동 모듬해물", amount: "150g" },
            { name: "부침가루", amount: "1.5컵" },
            { name: "달걀", amount: "1개" }
        ],
        travel_tips: [
            "모듬 해물은 물에 헹궈 해동한 뒤 물기를 완전히 빼고 올리며, 반죽을 프라이팬에 깐 뒤 그 위에 쪽파와 해물을 줄지어 올리세요.",
            "뒤집기 직전에 달걀 한 개를 깨서 위에 바르고 뒤집으면 해물이 흐트러지지 않고 잘 고정됩니다."
        ],
        youtube_search_keyword: "해물파전 바삭하게 만드는법 캠핑 안주",
        instagram_search_keyword: "해물파전"
    },

    // --- 8. 국물/밀키트 - 찌개/전골 ---
    {
        name: "부대찌개 의정부식 모듬 찌개",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "찌개/전골",
        ingredients: [
            { name: "모듬 소시지/햄", amount: "1팩" },
            { name: "사골곰탕 육수(시판)", amount: "1팩(500ml)" },
            { name: "라면사리", amount: "1개" },
            { name: "슬라이스 치즈", amount: "1장" },
            { name: "김치", amount: "2큰술" }
        ],
        travel_tips: [
            "사골육수를 베이스로 국물을 잡으면 조미료를 따로 넣지 않아도 부대찌개 전문점의 깊은 사골 맛을 쉽게 재현할 수 있습니다.",
            "라면사리와 치즈는 국물이 끓어 소시지 맛이 충분히 우러나온 마지막 단계에 추가해 주세요."
        ],
        youtube_search_keyword: "캠핑 부대찌개 사골육수 황금레시피",
        instagram_search_keyword: "캠핑부대찌개"
    },
    {
        name: "차돌박이 순두부찌개",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "찌개/전골",
        ingredients: [
            { name: "순두부", amount: "1봉지" },
            { name: "차돌박이", amount: "150g" },
            { name: "시판 순두부 양념", amount: "1팩" },
            { name: "달걀", amount: "1개" },
            { name: "대파", amount: "1/2대" }
        ],
        travel_tips: [
            "냄비에 차돌박이를 먼저 볶아 고기 기름이 나오면 양념장을 넣어 고추기름을 내어 준 뒤, 물과 순두부를 넣고 한소끔 끓여냅니다.",
            "불을 끄기 1분 전 계란을 노른자가 깨지지 않게 톡 떨어뜨리세요."
        ],
        youtube_search_keyword: "차돌 순두부찌개 백종원 캠핑 요리",
        instagram_search_keyword: "차돌순두부찌개"
    },
    {
        name: "돼지김치 짜글이",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "찌개/전골",
        ingredients: [
            { name: "돼지 찌개용 고기", amount: "300g" },
            { name: "김치", amount: "1컵" },
            { name: "고추장", amount: "1큰술" },
            { name: "고춧가루", amount: "1.5큰술" },
            { name: "감자", amount: "1/2개" }
        ],
        travel_tips: [
            "자작하게 끓여서 밥에 비벼 먹는 요리이므로 국물 양을 일반 찌개보다 작게 잡고 중불에서 감자가 뭉그러질 때까지 오래 졸이세요.",
            "감자를 채 썰어 넣으면 전분이 흘러나와 국물이 걸쭉해져 짜글이에 더 잘 어울립니다."
        ],
        youtube_search_keyword: "돼지고기 김치짜글이 그리들 요리",
        instagram_search_keyword: "김치짜글이"
    },
    {
        name: "차돌 된장찌개",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "찌개/전골",
        ingredients: [
            { name: "차돌박이", amount: "100g" },
            { name: "찌개용 두부", amount: "1/2모" },
            { name: "시판 된장찌개 양념", amount: "1팩" },
            { name: "애호박", amount: "1/3개" }
        ],
        travel_tips: [
            "차돌박이를 냄비 바닥에 구워 기름을 낸 다음 고추장 반 스푼, 된장 양념을 볶아 끓여주면 고깃집 특유의 진한 맛이 납니다.",
            "고기 쌈을 싸 먹고 남은 쌈장을 한 큰술 섞어주면 맛이 훨씬 풍부해집니다."
        ],
        youtube_search_keyword: "고깃집 차돌 된장찌개 캠핑 요리",
        instagram_search_keyword: "차돌된장찌개"
    },
    {
        name: "밀푀유나베 소고기 배추 전골",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "찌개/전골",
        ingredients: [
            { name: "샤브샤브용 소고기", amount: "200g" },
            { name: "알배기 배추", amount: "1통" },
            { name: "깻잎", amount: "1봉지" },
            { name: "시판 우동장국 육수", amount: "100ml" },
            { name: "팽이버섯/표고버섯", amount: "적당량" }
        ],
        travel_tips: [
            "배춧잎, 깻잎, 소고기를 겹겹이 쌓아 냄비 높이에 맞춰 썰어 냄비 가장자리부터 둥글게 채워 넣고 가운데 버섯을 꽂으면 비주얼이 화려합니다.",
            "밀키트로 준비해 가면 숙소나 캠핑장에서 육수만 붓고 끓이기만 하면 되어 가장 인기 있는 요리 중 하나입니다."
        ],
        youtube_search_keyword: "밀푀유나베 캠핑 밀키트 만들기",
        instagram_search_keyword: "밀푀유나베"
    },

    // --- 9. 국물/밀키트 - 탕/어묵탕 ---
    {
        name: "부산 꼬치 어묵탕",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "탕/어묵탕",
        ingredients: [
            { name: "꼬치 사각어묵", amount: "10개" },
            { name: "우동장국 쯔유", amount: "50ml" },
            { name: "무", amount: "1/8개" },
            { name: "청양고추", amount: "1개" },
            { name: "쑥갓", amount: "약간" }
        ],
        travel_tips: [
            "무와 쯔유를 넣은 국물을 먼저 시원하게 끓인 뒤, 어묵 꼬치를 담가 불지 않도록 어묵이 부풀어 오를 때까지만 짧게 익히는 것이 요령입니다.",
            "캠핑이나 추운 날 야외 테라스에서 끓여 먹으면 따뜻하게 체온을 유지하기 좋은 최고의 국물 안주입니다."
        ],
        youtube_search_keyword: "캠핑 꼬치 어묵탕 국물 시원하게",
        instagram_search_keyword: "꼬치어묵탕"
    },
    {
        name: "얼큰 나가사키 짬뽕탕",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "탕/어묵탕",
        ingredients: [
            { name: "시판 나가사키 짬뽕 밀키트", amount: "1팩" },
            { name: "모듬 숙주나물", amount: "1/2봉지" },
            { name: "베트남 고추 또는 청양고추", amount: "적당량" }
        ],
        travel_tips: [
            "동봉된 소스와 고기를 볶다가 해물을 넣고 끓인 후 마지막에 베트남 고추를 부수어 넣으면 칼칼하고 얼큰한 해장 짬뽕탕이 됩니다.",
            "남은 국물에 우동 사리나 라면 사리를 넣어 2차로 즐기기 좋습니다."
        ],
        youtube_search_keyword: "캠핑 나가사키 짬뽕탕 밀키트 요리",
        instagram_search_keyword: "나가사키짬뽕탕"
    },
    {
        name: "바지락 술찜",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "탕/어묵탕",
        ingredients: [
            { name: "해감 바지락", amount: "500g" },
            { name: "버터", amount: "15g" },
            { name: "화이트와인 또는 소주", amount: "1/2컵" },
            { name: "통마늘", amount: "5알" },
            { name: "페페론치노", amount: "3개" }
        ],
        travel_tips: [
            "버터에 마늘과 페페론치노를 볶다가 바지락을 넣고 센 불에서 화이트와인을 부어 잡내를 날리며 뚜껑을 닫아 바지락 입이 벌어질 때까지 끓입니다.",
            "바지락 입이 벌어지면 불을 즉시 꺼야 조갯살이 질겨지지 않고 통통하게 유지됩니다."
        ],
        youtube_search_keyword: "바지락 술찜 파스타 캠핑 요리",
        instagram_search_keyword: "바지락술찜"
    },
    {
        name: "황태 해장국",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "탕/어묵탕",
        ingredients: [
            { name: "황태채", amount: "50g" },
            { name: "무", amount: "1/8개" },
            { name: "들기름", amount: "2큰술" },
            { name: "달걀", amount: "1개" },
            { name: "국간장", amount: "1큰술" }
        ],
        travel_tips: [
            "들기름에 황태채와 나박 썬 무를 달달 볶아 고소한 향을 낸 후 물을 붓고 뽀얀 국물이 우러날 때까지 푹 끓여냅니다.",
            "여행 다음 날 아침, 전날 마신 술을 깨끗하게 해장해 주는 든든한 아침 메뉴입니다."
        ],
        youtube_search_keyword: "뽀얀 황태 해장국 끓이는법 여행 아침",
        instagram_search_keyword: "황태해장국"
    },
    {
        name: "차돌 만두전골",
        parentCategory: "🥘 국물/밀키트",
        childCategory: "탕/어묵탕",
        ingredients: [
            { name: "냉동만두", amount: "6-8개" },
            { name: "차돌박이", amount: "100g" },
            { name: "시판 전골 육수 또는 사골육수", amount: "500ml" },
            { name: "팽이버섯", amount: "1봉지" }
        ],
        travel_tips: [
            "사골 육수에 야채와 만두를 예쁘게 두르고 차돌박이를 가운데 얹어 한소끔 끓여냅니다. 준비 과정에 비해 엄청나게 푸짐한 요리입니다.",
            "만두가 터지면 국물이 탁해지므로 너무 오래 휘젓지 마세요."
        ],
        youtube_search_keyword: "차돌 만두전골 사골육수 캠핑",
        instagram_search_keyword: "만두전골"
    },

    // --- 10. 아침/브런치 - 샌드위치/토스트 ---
    {
        name: "길거리 계란 토스트",
        parentCategory: "🥗 아침/브런치",
        childCategory: "샌드위치/토스트",
        ingredients: [
            { name: "식빵", amount: "4장" },
            { name: "달걀", amount: "2개" },
            { name: "양배추 채", amount: "1컵" },
            { name: "슬라이스 햄", amount: "2장" },
            { name: "설탕/케첩", amount: "적당량" },
            { name: "버터", amount: "1큰술" }
        ],
        travel_tips: [
            "양배추를 섞은 달걀 반죽을 도톰하게 구워 버터에 노릇하게 구운 식빵 사이에 넣고, 설탕과 케첩을 듬뿍 뿌리는 것이 길거리 맛의 핵심입니다.",
            "종이컵이나 은박 호일로 빵 아래를 감싸 쥐고 먹으면 여행지 야외에서도 흘리지 않고 먹기 좋습니다."
        ],
        youtube_search_keyword: "캠핑 길거리 양배추 토스트 만들기",
        instagram_search_keyword: "길거리토스트"
    },
    {
        name: "프렌치 토스트 & 베이컨",
        parentCategory: "🥗 아침/브런치",
        childCategory: "샌드위치/토스트",
        ingredients: [
            { name: "식빵 또는 바게트", amount: "4장" },
            { name: "달걀", amount: "2개" },
            { name: "우유", amount: "50ml" },
            { name: "베이컨", amount: "4줄" },
            { name: "메이플 시럽 또는 슈가파우더", amount: "적당량" }
        ],
        travel_tips: [
            "식빵을 우유와 계란을 섞은 반죽에 듬뿍 적셔 버터를 두른 팬에 구운 뒤, 바삭하게 구운 베이컨을 곁들여 단짠 조화를 만드세요.",
            "아메리카노 커피와 함께하면 숙소 테라스에서 훌륭한 호텔식 조식을 즐길 수 있습니다."
        ],
        youtube_search_keyword: "호텔식 프렌치 토스트 캠핑 아침",
        instagram_search_keyword: "프렌치토스트"
    },
    {
        name: "스팸 몬테크리스토 샌드위치",
        parentCategory: "🥗 아침/브런치",
        childCategory: "샌드위치/토스트",
        ingredients: [
            { name: "식빵", amount: "3장" },
            { name: "슬라이스 치즈", amount: "2장" },
            { name: "스팸(얇게 썬 것)", amount: "2장" },
            { name: "딸기잼", amount: "2큰술" },
            { name: "달걀", amount: "1개" }
        ],
        travel_tips: [
            "식빵 한 면에는 딸기잼을 바르고 치즈와 구운 스팸을 넣은 뒤, 계란물을 입혀 프라이팬에 버터를 넣고 약불로 치즈가 녹을 때까지 굽습니다.",
            "치즈가 완전히 녹도록 뚜껑을 덮어주거나 약불에서 은은하게 조리하는 것이 포인트입니다."
        ],
        youtube_search_keyword: "몬테크리스토 샌드위치 펜션 브런치",
        instagram_search_keyword: "몬테크리스토"
    },

    // --- 11. 아침/브런치 - 샐러드/과일 ---
    {
        name: "리코타 치즈 청포도 샐러드",
        parentCategory: "🥗 아침/브런치",
        childCategory: "샐러드/과일",
        ingredients: [
            { name: "모듬 샐러드 채소", amount: "1봉지" },
            { name: "리코타 치즈", amount: "100g" },
            { name: "씨없는 청포도", amount: "10알" },
            { name: "발사믹 글레이즈", amount: "2큰술" }
        ],
        travel_tips: [
            "씻어 나온 모듬 샐러드 팩을 사용하면 여행지에서 손쉽게 훌륭한 비주얼의 샐러드를 완성할 수 있습니다.",
            "리코타 치즈는 스푼으로 둥글게 떠서 얹고 드레싱을 흩뿌려 서빙하세요."
        ],
        youtube_search_keyword: "초간단 리코타 치즈 샐러드 브런치",
        instagram_search_keyword: "리코타치즈샐러드"
    },
    {
        name: "토마토 카프레제 샐러드",
        parentCategory: "🥗 아침/브런치",
        childCategory: "샐러드/과일",
        ingredients: [
            { name: "토마토", amount: "2개" },
            { name: "생모짜렐라 치즈", amount: "1봉지" },
            { name: "바질페스토 또는 발사믹", amount: "2큰술" },
            { name: "올리브유", amount: "1큰술" }
        ],
        travel_tips: [
            "토마토와 모짜렐라 치즈를 같은 두께로 편 썰어 번갈아 겹쳐 놓고 드레싱을 얹어 내는 초간단 파티/조식 샐러드입니다.",
            "바질페스토가 없다면 올리브유와 허브솔트만 뿌려도 상큼하고 맛있습니다."
        ],
        youtube_search_keyword: "카프레제 샐러드 와인 안주 브런치",
        instagram_search_keyword: "카프레제"
    },

    // --- 12. 아침/브런치 - 죽/누룽지 ---
    {
        name: "사골 조미 김 참기름 죽",
        parentCategory: "🥗 아침/브런치",
        childCategory: "죽/누룽지",
        ingredients: [
            { name: "즉석밥", amount: "1공기" },
            { name: "시판 사골곰탕 육수", amount: "1/2팩" },
            { name: "조미김(조각)", amount: "1봉지" },
            { name: "참기름", amount: "1큰술" },
            { name: "달걀 노른자", amount: "1개" }
        ],
        travel_tips: [
            "사골곰탕 육수에 즉석밥을 넣고 밥알이 푹 퍼지도록 주걱으로 으깨며 약불에 끓인 뒤, 참기름과 부순 김가루를 올려 드세요.",
            "아침에 속이 불편하거나 해장이 급할 때 5분 만에 완성되는 영양 죽입니다."
        ],
        youtube_search_keyword: "캠핑 초간단 사골 죽 해장 아침",
        instagram_search_keyword: "사골죽"
    },
    {
        name: "구수한 가마솥 가래떡 누룽지 숭늉",
        parentCategory: "🥗 아침/브런치",
        childCategory: "죽/누룽지",
        ingredients: [
            { name: "시판 누룽지", amount: "1봉지" },
            { name: "물", amount: "600ml" },
            { name: "남은 가래떡", amount: "적당량" }
        ],
        travel_tips: [
            "그리들이나 냄비에 물과 누룽지, 얇게 썬 가래떡을 넣고 약불에서 보글보글 끓여 숭늉처럼 구수하게 들이켜 드세요.",
            "김치나 장아찌 반찬 하나만 곁들이면 아침 속풀이로 최고의 든든함을 줍니다."
        ],
        youtube_search_keyword: "캠핑 아침 누룽지 숭늉 끓이기",
        instagram_search_keyword: "누룽지숭늉"
    },

    // --- 13. 파티/스낵 - 핑거푸드/치즈 ---
    {
        name: "멜론 하몽 에멘탈 치즈 플래터",
        parentCategory: "🍹 파티/스낵",
        childCategory: "핑거푸드/치즈",
        ingredients: [
            { name: "멜론", amount: "1/2통" },
            { name: "하몽 또는 프로슈토 슬라이스", amount: "1팩" },
            { name: "크래커", amount: "1봉지" },
            { name: "슬라이스 에멘탈/큐브 치즈", amount: "적당량" }
        ],
        travel_tips: [
            "멜론을 한 입 크기로 썰어 껍질 위에 올린 뒤 하몽을 찢어서 위에 얹어내면 와인 바 스타일의 플래터가 쉽게 연출됩니다.",
            "하몽의 짭조름함과 멜론의 달콤함이 완벽한 단짠 와인 안주를 만들어 줍니다."
        ],
        youtube_search_keyword: "멜론 하몽 와인 안주 핑거푸드",
        instagram_search_keyword: "멜론하몽"
    },
    {
        name: "방울토마토 올리브 꼬치 (카나페)",
        parentCategory: "🍹 파티/스낵",
        childCategory: "핑거푸드/치즈",
        ingredients: [
            { name: "방울토마토", amount: "10개" },
            { name: "그린/블랙 올리브(통조림)", amount: "10개" },
            { name: "보코치니 치즈(미니 모짜렐라)", amount: "1팩" },
            { name: "이쑤시개 또는 미니꼬치", amount: "적당량" }
        ],
        travel_tips: [
            "이쑤시개에 올리브, 치즈, 방울토마토를 순서대로 꽂아 접시에 빙 둘러 담고 올리브유를 살짝 뿌려 내는 초간단 파티 핑거푸드입니다.",
            "만드는 과정이 간단해 여행지에서 아이들과 함께 조리 놀이로 하기도 좋습니다."
        ],
        youtube_search_keyword: "보코치니 치즈 올리브 카나페 꼬치",
        instagram_search_keyword: "치즈올리브꼬치"
    },

    // --- 14. 파티/스낵 - 튀김/마른안주 ---
    {
        name: "버터구이 오징어 & 청양마요소스",
        parentCategory: "🍹 파티/스낵",
        childCategory: "튀김/마른안주",
        ingredients: [
            { name: "반건조 오징어(피데기)", amount: "1마리" },
            { name: "버터", amount: "15g" },
            { name: "설탕", amount: "1작은술" },
            { name: "마요네즈", amount: "2큰술" },
            { name: "청양고추", amount: "1개" },
            { name: "간장", amount: "1작은술" }
        ],
        travel_tips: [
            "달군 팬에 버터와 설탕을 녹인 뒤 오징어를 앞뒤로 꾹꾹 눌러 굽고, 마요네즈+간장+다진 청양고추 소스를 곁들입니다.",
            "오징어 몸통 양가에 가위집을 내면 구울 때 오징어가 동그랗게 말려 타는 것을 방지할 수 있습니다."
        ],
        youtube_search_keyword: "영화관 버터오징어 청양마요 캠핑 안주",
        instagram_search_keyword: "피데기버터구이"
    },
    {
        name: "쥐포/아귀포 석쇠 구이",
        parentCategory: "🍹 파티/스낵",
        childCategory: "튀김/마른안주",
        ingredients: [
            { name: "쥐포 또는 아귀포", amount: "3장" },
            { name: "마요네즈", amount: "2큰술" }
        ],
        travel_tips: [
            "쥐포는 숯불 잔불이나 가스레인지 불에서 아주 약한 열로 살살 구워야 타지 않고 속까지 노릇하고 쫀득하게 익습니다.",
            "불이 세면 순식간에 시커멓게 타므로 집게로 잡고 허공에서 열기로만 앞뒤로 빠르게 구우세요."
        ],
        youtube_search_keyword: "쥐포 아귀포 타지않게 굽는 꿀팁",
        instagram_search_keyword: "아귀포구이"
    },
    {
        name: "황태채 바삭 버터 볶음",
        parentCategory: "🍹 파티/스낵",
        childCategory: "튀김/마른안주",
        ingredients: [
            { name: "황태채", amount: "50g" },
            { name: "버터", amount: "20g" },
            { name: "설탕", amount: "1작은술" },
            { name: "소금", amount: "한꼬집" }
        ],
        travel_tips: [
            "프라이팬에 버터를 두르고 황태채를 넣고 중약불에서 타지 않게 계속 저어가며 과자처럼 바삭해질 때까지 볶은 후 설탕을 뿌립니다.",
            "구운 황태채 냄새가 맥주를 부르는 사계절 전천후 안주입니다."
        ],
        youtube_search_keyword: "황태채 버터 볶음 과자 식감 캠핑 안주",
        instagram_search_keyword: "황태채버터구이"
    }
];

// Seeding Engine
async function seedData() {
    try {
        console.log("🚀 Starting database seeding for Travel Recipe Explorer...");

        // 1. Insert Categories (Tree Structure)
        const categoryMap: Record<string, number> = {};

        for (const parentNode of CATEGORY_TREE) {
            // Check if Parent Category Exists
            let parentId: number;
            const { data: existingParent } = await supabase
                .from('travel_recipe_categories')
                .select('id')
                .eq('name', parentNode.name)
                .is('parent_id', null)
                .single();

            if (existingParent) {
                parentId = existingParent.id;
                console.log(`- Parent category [${parentNode.name}] already exists (ID: ${parentId})`);
            } else {
                const { data: newParent, error: parentError } = await supabase
                    .from('travel_recipe_categories')
                    .insert({
                        name: parentNode.name,
                        icon_emoji: parentNode.icon_emoji,
                        sort_order: parentNode.sort_order,
                        parent_id: null
                    })
                    .select()
                    .single();

                if (parentError || !newParent) {
                    throw new Error(`Failed to insert parent category: ${parentError?.message}`);
                }
                parentId = newParent.id;
                console.log(`- Created parent category [${parentNode.name}] (ID: ${parentId})`);
            }

            // Insert Children
            for (const childNode of parentNode.children) {
                const key = `${parentNode.name}_${childNode.name}`;
                
                // Check if Child Category Exists
                const { data: existingChild } = await supabase
                    .from('travel_recipe_categories')
                    .select('id')
                    .eq('name', childNode.name)
                    .eq('parent_id', parentId)
                    .single();

                if (existingChild) {
                    categoryMap[key] = existingChild.id;
                } else {
                    const { data: newChild, error: childError } = await supabase
                        .from('travel_recipe_categories')
                        .insert({
                            name: childNode.name,
                            parent_id: parentId,
                            sort_order: childNode.sort_order
                        })
                        .select()
                        .single();

                    if (childError || !newChild) {
                        throw new Error(`Failed to insert child category: ${childError?.message}`);
                    }
                    categoryMap[key] = newChild.id;
                    console.log(`  + Created child category [${childNode.name}] (ID: ${newChild.id})`);
                }
            }
        }

        console.log("✅ Categories setup complete.");

        // 2. Prep & Insert Recipes
        console.log(`📦 Preparing ${RECIPE_POOL.length} recipes for ingestion...`);
        const dbRecipes = RECIPE_POOL.map(r => {
            const key = `${r.parentCategory}_${r.childCategory}`;
            const categoryId = categoryMap[key];
            if (!categoryId) {
                console.warn(`Warning: Category not found for key: ${key}`);
            }

            return {
                category_id: categoryId || null,
                name: r.name,
                ingredients: r.ingredients,
                travel_tips: r.travel_tips,
                youtube_search_keyword: r.youtube_search_keyword,
                instagram_search_keyword: r.instagram_search_keyword,
                view_count: Math.floor(Math.random() * 50) + 10 // Random initial popular counts
            };
        });

        // Insert in batches of 50 to prevent size limits
        const batchSize = 50;
        let successCount = 0;

        for (let i = 0; i < dbRecipes.length; i += batchSize) {
            const batch = dbRecipes.slice(i, i + batchSize);
            
            // Deduplicate: check if recipe already exists in table
            const names = batch.map(b => b.name);
            const { data: existingRecipes } = await supabase
                .from('travel_recipes')
                .select('name')
                .in('name', names);

            const existingNames = new Set(existingRecipes?.map(e => e.name) || []);
            const finalBatch = batch.filter(b => !existingNames.has(b.name));

            if (finalBatch.length > 0) {
                const { error: insertError } = await supabase
                    .from('travel_recipes')
                    .insert(finalBatch);

                if (insertError) {
                    console.error("Batch Insertion Error:", insertError);
                    throw insertError;
                }
                successCount += finalBatch.length;
                console.log(`- Ingested batch ${i / batchSize + 1}: +${finalBatch.length} recipes.`);
            } else {
                console.log(`- Batch ${i / batchSize + 1}: All recipes already exist. Skipped.`);
            }
        }

        console.log(`🎉 DB Seeding Finished! Ingested ${successCount} new recipes into public.travel_recipes.`);

    } catch (e: any) {
        console.error("❌ Seeding failed:", e.message);
    }
}

seedData();
