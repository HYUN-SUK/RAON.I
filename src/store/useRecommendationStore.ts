import { create } from 'zustand';

// Define Recommendation Item Type
export type RecommendationCategory = 'play' | 'cook' | 'event' | 'mission';

export interface RecommendationItem {
    id: string;
    category: RecommendationCategory;
    categoryLabel: string;
    title: string;
    icon: string; // Emoji or Icon name
    bgColorClass: string; // e.g., 'bg-orange-50 dark:bg-orange-950/20'
    textColorClass: string; // e.g., 'text-orange-600'
    timeSlot: ('morning' | 'day' | 'night' | 'any')[];
    weather: ('sunny' | 'rain' | 'snow' | 'any')[];
}

// Master Data (L0 Rule-based Data)
const RECOMMENDATION_DATA: RecommendationItem[] = [
    // Morning (06-11)
    { id: 'm-1', category: 'play', categoryLabel: '루틴', title: '아침 산책하기', icon: '🌿', bgColorClass: 'bg-green-50 dark:bg-green-950/20', textColorClass: 'text-green-600', timeSlot: ['morning'], weather: ['sunny', 'any'] },
    { id: 'm-2', category: 'cook', categoryLabel: '조식', title: '따뜻한 드립커피', icon: '☕', bgColorClass: 'bg-amber-50 dark:bg-amber-950/20', textColorClass: 'text-amber-600', timeSlot: ['morning'], weather: ['any'] },
    { id: 'm-3', category: 'event', categoryLabel: '주변 행사', title: '숲속 요가', icon: '🧘', bgColorClass: 'bg-blue-50 dark:bg-blue-950/20', textColorClass: 'text-blue-600', timeSlot: ['morning'], weather: ['sunny'] },

    // Day (11-17)
    { id: 'd-1', category: 'play', categoryLabel: '활동', title: '계곡 물놀이', icon: '🌊', bgColorClass: 'bg-cyan-50 dark:bg-cyan-950/20', textColorClass: 'text-cyan-600', timeSlot: ['day'], weather: ['sunny'] },
    { id: 'd-2', category: 'cook', categoryLabel: '점심', title: '간단한 샌드위치', icon: '🥪', bgColorClass: 'bg-orange-50 dark:bg-orange-950/20', textColorClass: 'text-orange-600', timeSlot: ['day'], weather: ['any'] },
    { id: 'd-3', category: 'mission', categoryLabel: '미션', title: '다람쥐 찾기', icon: '🐿️', bgColorClass: 'bg-stone-100 dark:bg-stone-800', textColorClass: 'text-stone-600', timeSlot: ['day'], weather: ['sunny'] },

    // Night (17-06)
    { id: 'n-1', category: 'play', categoryLabel: '놀이', title: '불멍하기 좋은 밤', icon: '🔥', bgColorClass: 'bg-orange-50 dark:bg-orange-950/20', textColorClass: 'text-orange-600', timeSlot: ['night'], weather: ['sunny', 'any'] },
    { id: 'n-2', category: 'cook', categoryLabel: '석식', title: '따뜻한 어묵탕', icon: '🍲', bgColorClass: 'bg-red-50 dark:bg-red-950/20', textColorClass: 'text-red-600', timeSlot: ['night'], weather: ['any'] },
    { id: 'n-3', category: 'event', categoryLabel: '주변 행사', title: '별보기 투어', icon: '✨', bgColorClass: 'bg-purple-50 dark:bg-purple-950/20', textColorClass: 'text-purple-600', timeSlot: ['night'], weather: ['sunny'] },

    // Rain Specific
    { id: 'r-1', category: 'play', categoryLabel: '감성', title: '빗소리 감상', icon: '🌧️', bgColorClass: 'bg-slate-100 dark:bg-slate-800', textColorClass: 'text-slate-600', timeSlot: ['any'], weather: ['rain'] },
    { id: 'r-2', category: 'cook', categoryLabel: '요리', title: '바삭한 김치전', icon: '🍳', bgColorClass: 'bg-yellow-50 dark:bg-yellow-950/20', textColorClass: 'text-yellow-600', timeSlot: ['any'], weather: ['rain'] },

    // Default Fillers
    { id: 'def-1', category: 'mission', categoryLabel: '미션', title: '쓰레기 줍기', icon: '🌱', bgColorClass: 'bg-green-50 dark:bg-green-950/20', textColorClass: 'text-green-600', timeSlot: ['any'], weather: ['any'] },
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

        // Filter logic
        let filtered = RECOMMENDATION_DATA.filter(item => {
            const matchTime = item.timeSlot.includes(currentTimeSlot) || item.timeSlot.includes('any');
            const matchWeather = item.weather.includes(currentWeather) || item.weather.includes('any');
            return matchTime && matchWeather;
        });

        // Sort priority: Exact weather match > Exact time match > 'any'
        filtered.sort((a, b) => {
            const aScore = (a.weather.includes(currentWeather) ? 2 : 0) + (a.timeSlot.includes(currentTimeSlot) ? 1 : 0);
            const bScore = (b.weather.includes(currentWeather) ? 2 : 0) + (b.timeSlot.includes(currentTimeSlot) ? 1 : 0);
            return bScore - aScore;
        });

        // Pick top 4
        set({ currentRecommendations: filtered.slice(0, 4) });
    }
}));
