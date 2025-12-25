import { create } from 'zustand';

// Define Recommendation Item Type
export type RecommendationCategory = 'play' | 'cook' | 'event' | 'mission';

export interface RecommendationItem {
    id: string;
    category: RecommendationCategory;
    categoryLabel: string;
    title: string;
    description?: string; // SSOT: Rich description
    actionLabel?: string; // SSOT: 'Recipe', 'Map', 'Join'
    actionLink?: string;  // SSOT: Link to detailed page
    icon: string; // Emoji
    bgColorClass: string;
    textColorClass: string;
    timeSlot: ('morning' | 'day' | 'night' | 'any')[];
    weather: ('sunny' | 'rain' | 'snow' | 'any')[];
}

// Master Data (L0 Rule-based Data) - Ref SSOT 9.3
const RECOMMENDATION_DATA: RecommendationItem[] = [
    // Morning (06-11)
    {
        id: 'm-1', category: 'play', categoryLabel: '오늘의 게임',
        title: '아침 숲 산책하기',
        description: '상쾌한 아침 공기를 마시며 캠핑장 주변 숲길을 걸어보세요. 새소리와 함께 하루를 시작하는 완벽한 방법입니다.',
        actionLabel: '산책로 지도', actionLink: '/map?filter=trail',
        icon: '🌿', bgColorClass: 'bg-green-50 dark:bg-green-950/20', textColorClass: 'text-green-600',
        timeSlot: ['morning'], weather: ['sunny', 'any']
    },
    {
        id: 'm-2', category: 'cook', categoryLabel: '오늘의 요리 (아침)',
        title: '따뜻한 드립커피',
        description: '원두의 향긋함이 텐트 안에 가득 퍼질 거예요. 쌀쌀한 아침, 따뜻한 커피 한 잔의 여유를 즐겨보세요.',
        actionLabel: '레시피 보기', actionLink: '/community?tag=coffee',
        icon: '☕', bgColorClass: 'bg-amber-50 dark:bg-amber-950/20', textColorClass: 'text-amber-600',
        timeSlot: ['morning'], weather: ['any']
    },
    {
        id: 'm-3', category: 'event', categoryLabel: '주변 행사',
        title: '숲속 모닝 요가',
        description: '잔디 광장에서 진행되는 무료 요가 클래스입니다. 굳은 몸을 깨우고 자연과 하나되는 시간을 가져보세요.',
        actionLabel: '참여 신청', actionLink: '/mission/yoga-class',
        icon: '🧘', bgColorClass: 'bg-blue-50 dark:bg-blue-950/20', textColorClass: 'text-blue-600',
        timeSlot: ['morning'], weather: ['sunny']
    },

    // Day (11-17)
    {
        id: 'd-1', category: 'play', categoryLabel: '오늘의 게임',
        title: '계곡 물놀이 & 수박',
        description: '시원한 계곡물에 발을 담그고 수박을 먹으며 더위를 날려보세요. 아이들과 함께 물고기를 찾아보는 건 어떨까요?',
        actionLabel: '계곡 위치', actionLink: '/map?filter=water',
        icon: '🌊', bgColorClass: 'bg-cyan-50 dark:bg-cyan-950/20', textColorClass: 'text-cyan-600',
        timeSlot: ['day'], weather: ['sunny']
    },
    {
        id: 'd-2', category: 'cook', categoryLabel: '오늘의 요리 (점심)',
        title: '간단한 클럽 샌드위치',
        description: '불 없이 뚝딱 만들 수 있는 샌드위치입니다. 신선한 야채와 햄, 치즈로 든든한 점심을 해결하세요.',
        actionLabel: '재료 보기', actionLink: '/market?category=food',
        icon: '🥪', bgColorClass: 'bg-orange-50 dark:bg-orange-950/20', textColorClass: 'text-orange-600',
        timeSlot: ['day'], weather: ['any']
    },
    {
        id: 'd-3', category: 'event', categoryLabel: '주변 행사',
        title: '주말 플리마켓',
        description: '캠퍼들이 직접 만든 굿즈와 중고 장비를 구경해보세요. 뜻밖의 득템 기회가 기다리고 있습니다!',
        actionLabel: '위치 확인', actionLink: '/event/market',
        icon: '🎪', bgColorClass: 'bg-pink-50 dark:bg-pink-950/20', textColorClass: 'text-pink-600',
        timeSlot: ['day'], weather: ['sunny', 'any']
    },
    {
        id: 'd-4', category: 'mission', categoryLabel: '추천 미션',
        title: '다람쥐 친구 찾기',
        description: '캠핑장 곳곳에 숨어있는 다람쥐를 찾아 사진을 찍어보세요. 성공시 도토.. 아니 포인트가 지급됩니다!',
        actionLabel: '미션 시작', actionLink: '/mission/squirrel',
        icon: '🐿️', bgColorClass: 'bg-stone-100 dark:bg-stone-800', textColorClass: 'text-stone-600',
        timeSlot: ['day'], weather: ['sunny']
    },

    // Night (17-06)
    {
        id: 'n-1', category: 'play', categoryLabel: '오늘의 감성',
        title: '불멍하기 좋은 밤',
        description: '타닥타닥 타오르는 장작 소리에 귀 기울여보세요. 불멍 가루를 뿌리면 오로라를 볼 수 있어요.',
        actionLabel: '불멍 가이드', actionLink: '/guide/fire',
        icon: '🔥', bgColorClass: 'bg-orange-50 dark:bg-orange-950/20', textColorClass: 'text-orange-600',
        timeSlot: ['night'], weather: ['sunny', 'any']
    },
    {
        id: 'n-2', category: 'cook', categoryLabel: '오늘의 요리 (저녁)',
        title: '따뜻한 어묵탕',
        description: '쌀쌀한 밤공기엔 뜨끈한 국물이 최고죠. 꼬치어묵과 무를 넣어 시원하게 끓여보세요.',
        actionLabel: '밀키트 구매', actionLink: '/market/product/fishcake',
        icon: '🍲', bgColorClass: 'bg-red-50 dark:bg-red-950/20', textColorClass: 'text-red-600',
        timeSlot: ['night'], weather: ['any']
    },
    {
        id: 'n-3', category: 'event', categoryLabel: '주변 행사',
        title: '별보기 투어',
        description: '오늘 밤은 별이 유난히 잘 보입니다. 관리동 옥상에서 진행되는 별자리 설명회에 참여해보세요.',
        actionLabel: '시간 확인', actionLink: '/event/star',
        icon: '✨', bgColorClass: 'bg-purple-50 dark:bg-purple-950/20', textColorClass: 'text-purple-600',
        timeSlot: ['night'], weather: ['sunny']
    },

    // Rain Specific
    {
        id: 'r-1', category: 'play', categoryLabel: '오늘의 게임',
        title: '빗소리 감상 & 독서',
        description: '텐트 위로 떨어지는 빗소리는 최고의 백색소음입니다. 따뜻한 차 한 잔과 함께 책을 읽어보세요.',
        actionLabel: '추천 도서', actionLink: '/community/books',
        icon: '🌧️', bgColorClass: 'bg-slate-100 dark:bg-slate-800', textColorClass: 'text-slate-600',
        timeSlot: ['any'], weather: ['rain']
    },
    {
        id: 'r-2', category: 'cook', categoryLabel: '오늘의 요리 (비)',
        title: '바삭한 김치전',
        description: '비 오는 날엔 역시 기름 냄새가 최고죠. 김치와 오징어를 썰어 넣고 바삭하게 부쳐보세요.',
        actionLabel: '레시피', actionLink: '/community/recipe/kimchi',
        icon: '🍳', bgColorClass: 'bg-yellow-50 dark:bg-yellow-950/20', textColorClass: 'text-yellow-600',
        timeSlot: ['any'], weather: ['rain']
    },

    // Default Fillers
    {
        id: 'def-1', category: 'mission', categoryLabel: '오늘의 선행',
        title: '쓰레기 줍기 (플로깅)',
        description: '머문 자리가 아름다워야 진짜 캠퍼! 캠핑장 주변 쓰레기를 주우면 뿌듯함이 2배.',
        actionLabel: '인증하기', actionLink: '/mission/plogging',
        icon: '🌱', bgColorClass: 'bg-green-50 dark:bg-green-950/20', textColorClass: 'text-green-600',
        timeSlot: ['any'], weather: ['any']
    },
];

interface RecommendationState {
    currentRecommendations: RecommendationItem[];
    currentTimeSlot: 'morning' | 'day' | 'night';
    currentWeather: 'sunny' | 'rain';

    // Actions
    updateContext: (hour?: number, weather?: 'sunny' | 'rain') => void;
    refreshRecommendations: () => void;
}

export const useRecommendationStore = create<RecommendationState>((set, get) => ({
    currentRecommendations: [],
    currentTimeSlot: 'day',
    currentWeather: 'sunny',

    updateContext: (hour = new Date().getHours(), weather = 'sunny') => {
        let slot: 'morning' | 'day' | 'night' = 'day';
        if (hour >= 6 && hour < 11) slot = 'morning';
        else if (hour >= 11 && hour < 17) slot = 'day';
        else slot = 'night';

        set({ currentTimeSlot: slot, currentWeather: weather });
        get().refreshRecommendations();
    },

    refreshRecommendations: () => {
        const { currentTimeSlot, currentWeather } = get();

        // 1. Filter: Exclude missions, match Time & Weather
        const candidates = RECOMMENDATION_DATA.filter(item => {
            if (item.category === 'mission') return false; // Explicitly exclude missions
            const matchTime = item.timeSlot.includes(currentTimeSlot) || item.timeSlot.includes('any');
            const matchWeather = item.weather.includes(currentWeather) || item.weather.includes('any');
            return matchTime && matchWeather;
        });

        // 2. Strategy: We need 3 items for Bento (2 Top + 1 Wide Bottom)
        // Ideally: 1 Play, 1 Cook, 1 Event
        const categories: RecommendationCategory[] = ['play', 'cook', 'event'];
        const selected: RecommendationItem[] = [];

        // Try to pick one from each category
        categories.forEach(cat => {
            const bestInCat = candidates
                .filter(item => item.category === cat)
                .sort((a, b) => {
                    // Priority: Exact Weather > Exact Time
                    const aScore = (a.weather.includes(currentWeather) ? 2 : 0) + (a.timeSlot.includes(currentTimeSlot) ? 1 : 0);
                    const bScore = (b.weather.includes(currentWeather) ? 2 : 0) + (b.timeSlot.includes(currentTimeSlot) ? 1 : 0);
                    return bScore - aScore;
                })[0];

            if (bestInCat) selected.push(bestInCat);
        });

        // If we still don't have 3, fill with remaining candidates
        if (selected.length < 3) {
            const existingIds = new Set(selected.map(s => s.id));
            const remainders = candidates.filter(c => !existingIds.has(c.id));
            const fillers = remainders.slice(0, 3 - selected.length);
            selected.push(...fillers);
        }

        // 3. Final Sort for Layout (Optional: Event at bottom? or random?)
        // Let's keep them in [Play, Cook, Event] order defined by `categories` loop usually, 
        // but if we want 'Event' to be the wide bottom one (index 2), we can arrange it.
        // Current logic pushes in order of 'play', 'cook', 'event'. 
        // Index 0: Play (Top Left), Index 1: Cook (Top Right), Index 2: Event (Bottom Wide).

        set({ currentRecommendations: selected.slice(0, 3) });
    }
}));
