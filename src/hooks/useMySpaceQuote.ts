"use client";

import { useState, useEffect, useMemo } from 'react';
import { useWeather, WeatherType } from '@/hooks/useWeather';
import { useLBS } from '@/hooks/useLBS';
import { createClient } from '@/lib/supabase-client';

type Season = 'spring' | 'summer' | 'autumn' | 'winter';
type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';
type TempRange = 'freezing' | 'cold' | 'cool' | 'mild' | 'warm' | 'hot' | 'scorching';

interface QuoteContext {
    season: Season;
    time: TimeOfDay;
    weather: WeatherType;
    tempRange: TempRange;
    hasKids: boolean;
    isCouple: boolean;
}

// ═══════════════════════════════════════════════════════════════════════════
// 100개 이상의 "나만의 기록 공간 + 기록 권유" 문학적 감성 문구
// 계절/날씨/온도/시간/사용자 특성 + 기록/수첩/책자 테마
// ═══════════════════════════════════════════════════════════════════════════

const QUOTES = {
    // ═════════════════════════════════════════════════════════════════════
    // 🌸 봄 (Spring) - 기록 권유
    // ═════════════════════════════════════════════════════════════════════
    spring: {
        dawn: [
            "새벽 안개처럼 스쳐 지나가는 생각들, 기록해두세요.",
            "봄 새벽의 고요함을 당신의 수첩에 담아보세요.",
            "이른 아침, 잠에서 깬 첫 생각을 적어볼까요?",
        ],
        morning: [
            "봄 햇살처럼 따스한 오늘을 기록으로 남겨보세요.",
            "꽃잎처럼 피어나는 당신의 이야기, 여기에 적어주세요.",
            "새싹처럼 시작하는 하루, 첫 문장을 써볼까요?",
            "봄바람에 실려온 영감을 놓치지 마세요. 기록해두세요.",
            "오늘 본 꽃의 색깔, 당신의 일기에 어울릴 것 같아요.",
        ],
        afternoon: [
            "나른한 봄날 오후의 생각들, 흘려보내지 마세요.",
            "봄볕 아래 떠오른 아이디어를 적어두세요.",
            "이 순간의 평화로움을 당신만의 언어로 담아보세요.",
            "피크닉 중 떠오른 생각, 잊기 전에 메모해볼까요?",
        ],
        evening: [
            "봄 저녁의 노을빛처럼 따뜻한 하루를 기록해보세요.",
            "오늘 하루, 어떤 이야기가 가장 기억에 남나요?",
            "하루의 끝, 마음에 남은 것들을 정리해볼까요?",
        ],
        night: [
            "봄밤의 달빛 아래, 오늘을 돌아보며 적어보세요.",
            "꽃향기 가득한 밤, 당신의 수첩을 펼쳐볼 시간이에요.",
            "잠들기 전, 오늘의 감사한 순간을 기록해보세요.",
        ],
    },

    // ═════════════════════════════════════════════════════════════════════
    // ☀️ 여름 (Summer) - 기록 권유
    // ═════════════════════════════════════════════════════════════════════
    summer: {
        dawn: [
            "새벽의 서늘함 속에서 떠오른 생각을 적어보세요.",
            "해 뜨기 전의 고요함, 기록하기 좋은 시간이에요.",
            "여름 새벽의 맑은 정신으로 한 줄 써볼까요?",
        ],
        morning: [
            "싱그러운 여름 아침처럼 신선한 이야기를 시작해보세요.",
            "매미 소리를 배경음악 삼아, 오늘의 첫 문장을 써볼까요?",
            "초록빛 가득한 오늘을 당신의 수첩에 담아보세요.",
            "여름 아침의 활기를 당신의 기록에 불어넣어 보세요.",
        ],
        afternoon: [
            "그늘 아래서 잠시 쉬며, 생각을 정리해볼까요?",
            "더위를 피해 앉은 자리에서, 한 줄 기록해보세요.",
            "아이스 커피와 함께 오늘의 이야기를 써볼까요?",
            "뜨거운 오후, 시원한 생각을 기록해두세요.",
        ],
        evening: [
            "해가 지면서 찾아온 여유, 기록하기 좋은 시간이에요.",
            "시원한 저녁 바람과 함께 오늘을 돌아볼까요?",
            "바비큐 연기 속에서도 떠오르는 생각, 적어두세요.",
            "여름 저녁놀처럼 아름다운 하루를 기록해보세요.",
        ],
        night: [
            "별빛 아래서 오늘의 이야기를 마무리해볼까요?",
            "반딧불이처럼 반짝이는 순간들을 적어보세요.",
            "여름밤의 낭만을 당신만의 문장으로 남겨보세요.",
            "시원한 밤바람 속에서 생각을 정리해보세요.",
            "은하수처럼 흐르는 오늘의 기억을 기록해두세요.",
        ],
    },

    // ═════════════════════════════════════════════════════════════════════
    // 🍂 가을 (Autumn) - 기록 권유
    // ═════════════════════════════════════════════════════════════════════
    autumn: {
        dawn: [
            "가을 새벽의 맑은 공기처럼 깨끗한 마음으로 적어보세요.",
            "서리 내린 아침, 첫 생각을 수첩에 담아볼까요?",
            "고요한 가을 새벽, 당신의 이야기를 시작해보세요.",
        ],
        morning: [
            "단풍처럼 물드는 당신의 이야기를 기록해보세요.",
            "낙엽 밟는 소리처럼 정겨운 오늘을 남겨볼까요?",
            "커피 김 모락모락 피어오르는 아침, 수첩을 펼쳐보세요.",
            "가을빛처럼 황금같은 순간들을 놓치지 마세요.",
        ],
        afternoon: [
            "독서하기 좋은 날, 당신의 책도 한 페이지 채워볼까요?",
            "높고 푸른 하늘 아래 떠오르는 생각을 적어보세요.",
            "쓸쓸하면서도 아름다운 오후를 기록해두세요.",
            "차 한 잔과 함께 오늘의 이야기를 정리해볼까요?",
        ],
        evening: [
            "가을 저녁놀처럼 붉게 물드는 하루를 기록해보세요.",
            "불멍하며 떠오르는 생각들, 흘려보내지 마세요.",
            "따뜻한 국물처럼 마음을 덥히는 글을 써볼까요?",
            "오늘 하루, 당신의 수첩에 어떤 색으로 남을까요?",
        ],
        night: [
            "가을밤의 밝은 달 아래, 오늘을 정리해보세요.",
            "낙엽 향기 가득한 밤, 기록하기 좋은 시간이에요.",
            "별이 선명한 가을밤, 당신의 이야기도 선명하게 남겨보세요.",
            "서늘한 바람 속에서 따뜻한 기록을 남겨볼까요?",
        ],
    },

    // ═════════════════════════════════════════════════════════════════════
    // ❄️ 겨울 (Winter) - 기록 권유
    // ═════════════════════════════════════════════════════════════════════
    winter: {
        dawn: [
            "고요한 겨울 새벽, 당신만의 시간에 기록을 남겨보세요.",
            "입김처럼 피어오르는 생각을 놓치지 마세요.",
            "담요 속에서 떠오른 아이디어를 적어볼까요?",
        ],
        morning: [
            "서리 내린 창문처럼 맑은 마음으로 적어보세요.",
            "따뜻한 커피와 함께 오늘의 첫 문장을 시작해볼까요?",
            "겨울 아침의 고요함을 당신의 수첩에 담아보세요.",
            "차가운 공기가 맑은 생각을 가져다줘요. 기록해보세요.",
        ],
        afternoon: [
            "볕 좋은 자리에서 따뜻하게 기록해볼까요?",
            "핫초코처럼 달콤한 오늘의 순간들을 적어두세요.",
            "겨울 오후의 여유를 당신만의 문장으로 남겨보세요.",
        ],
        evening: [
            "어둠이 일찍 찾아온 저녁, 기록하기 좋은 시간이에요.",
            "불멍의 온기 속에서 오늘을 돌아볼까요?",
            "따뜻한 국물처럼 마음을 데우는 글을 써보세요.",
        ],
        night: [
            "별이 유리처럼 맑은 밤, 수첩을 펼쳐볼 시간이에요.",
            "불멍의 따스함 속에서 하루를 정리해보세요.",
            "추운 밤일수록 따뜻한 기록이 소중해요.",
            "눈 덮인 고요한 밤, 당신의 이야기를 써볼까요?",
            "겨울밤의 별처럼 빛나는 순간들을 기록해두세요.",
        ],
    },

    // ═════════════════════════════════════════════════════════════════════
    // 🌧️ 날씨별 특수 문구 - 기록 권유
    // ═════════════════════════════════════════════════════════════════════
    weather: {
        rainy: [
            "빗소리를 배경음악 삼아, 오늘을 기록해볼까요?",
            "비 오는 날은 글 쓰기에 가장 좋은 날이에요.",
            "창밖의 빗방울처럼 생각을 한 줄씩 적어보세요.",
            "촉촉한 날씨에 촉촉한 감성으로 기록해보세요.",
            "빗속에서 떠오른 생각, 놓치지 마세요.",
            "비 갠 뒤의 무지개처럼 빛나는 기록을 남겨볼까요?",
            "빗소리가 타자 소리를 닮았네요. 함께 써볼까요?",
            "우산 밑에서도 수첩을 펼쳐보는 건 어떨까요?",
        ],
        snowy: [
            "눈 내리는 풍경처럼 순수한 마음으로 적어보세요.",
            "하얀 눈처럼 깨끗한 페이지를 채워볼까요?",
            "눈꽃처럼 아름다운 당신의 이야기를 남겨주세요.",
            "소복소복 쌓이는 눈처럼, 기록도 쌓아가볼까요?",
            "동화 같은 오늘을 당신의 수첩에 담아보세요.",
            "첫눈처럼 설레는 마음으로 첫 문장을 써볼까요?",
            "눈 덮인 세상을 당신만의 언어로 표현해보세요.",
        ],
        cloudy: [
            "흐린 날의 여유로움을 기록으로 남겨볼까요?",
            "구름 낀 날도 당신의 이야기는 빛날 수 있어요.",
            "몽환적인 분위기 속에서 글을 써보세요.",
            "은은한 빛 아래서 은은한 이야기를 적어볼까요?",
            "햇살이 숨어버린 날, 당신의 생각은 더 선명해져요.",
        ],
        sunny: [
            "맑은 하늘처럼 맑은 마음으로 기록해보세요.",
            "햇살 가득한 오늘을 당신의 수첩에 담아볼까요?",
            "빛나는 오늘, 빛나는 기록을 남겨보세요.",
            "그늘 아래 앉아 햇살 같은 글을 써볼까요?",
        ],
    },

    // ═════════════════════════════════════════════════════════════════════
    // 🌡️ 극한 온도 문구 - 기록 권유
    // ═════════════════════════════════════════════════════════════════════
    temperature: {
        freezing: [
            "추운 날일수록 따뜻한 기록이 소중해져요.",
            "언 손을 녹이며 마음도 함께 녹여보는 글을 써볼까요?",
            "모닥불 앞에서 오늘을 정리해보는 건 어떨까요?",
            "한파 속에서도 당신의 이야기는 따뜻해요.",
        ],
        scorching: [
            "더위를 피해 그늘에서 기록하는 시간을 가져보세요.",
            "시원한 곳에서 시원한 생각을 적어볼까요?",
            "뜨거운 오늘, 시원하게 정리해보는 건 어떨까요?",
            "더위만큼 뜨거운 당신의 이야기를 남겨보세요.",
        ],
    },

    // ═════════════════════════════════════════════════════════════════════
    // 👨‍👩‍👧 사용자 특성별 문구 - 기록 권유
    // ═════════════════════════════════════════════════════════════════════
    family: {
        withKids: [
            "아이와 함께한 순간들, 놓치지 말고 기록해두세요.",
            "아이의 첫 캠핑 모습을 수첩에 담아볼까요?",
            "아이가 한 말 중 기억에 남는 것을 적어보세요.",
            "가족과의 소중한 순간, 글로 남겨두면 오래 기억해요.",
            "아이의 눈에 비친 세상을 당신의 언어로 적어볼까요?",
            "함께한 놀이, 함께한 웃음을 기록해두세요.",
            "아이가 자라면 함께 읽을 기록을 남겨보세요.",
        ],
        couple: [
            "둘만의 이야기를 소중히 기록해보세요.",
            "함께한 오늘을 당신의 수첩에 담아볼까요?",
            "나란히 앉아 각자의 기록을 남겨보는 건 어떨까요?",
            "사랑하는 사람과의 순간, 글로 남겨두세요.",
            "오늘 나눈 대화 중 기억하고 싶은 것을 적어보세요.",
        ],
    },

    // ═════════════════════════════════════════════════════════════════════
    // 🌟 범용 기록 권유 문구
    // ═════════════════════════════════════════════════════════════════════
    universal: [
        "이곳은 당신만의 이야기가 쌓이는 공간이에요.",
        "빈 페이지가 당신의 이야기를 기다리고 있어요.",
        "잠깐 멈추고, 오늘의 한 줄을 남겨볼까요?",
        "기록하지 않으면 흘러가버리는 순간들이 있어요.",
        "당신의 속도로, 당신만의 이야기를 채워가세요.",
        "오늘 느낀 것들을 문장으로 정리해보세요.",
        "작은 기록이 큰 추억이 되는 순간이 있어요.",
        "수첩 한 권이 당신의 여정을 담고 있어요.",
        "지금 이 순간을 글로 남겨볼까요?",
        "기억은 흐려져도, 기록은 선명하게 남아요.",
        "오늘의 나를 내일의 내가 읽을 수 있도록 적어두세요.",
        "당신의 캠핑 일기, 여기서 시작해보세요.",
        "한 줄이라도 괜찮아요. 시작이 반이에요.",
        "이 공간은 당신만의 디지털 수첩이에요.",
        "오늘 하루, 어떤 이야기를 남기고 싶으세요?",
    ],
};

// ═══════════════════════════════════════════════════════════════════════════
// 훅 본체
// ═══════════════════════════════════════════════════════════════════════════

export function useMySpaceQuote() {
    const [quote, setQuote] = useState<string>("빈 페이지가 당신의 이야기를 기다리고 있어요.");
    const [userProfile, setUserProfile] = useState<{ family_type?: string } | null>(null);

    const lbs = useLBS();
    const weather = useWeather(
        !lbs.usingDefault ? lbs.location.latitude : undefined,
        !lbs.usingDefault ? lbs.location.longitude : undefined
    );

    // Fetch user profile
    useEffect(() => {
        const fetchProfile = async () => {
            const supabase = createClient();
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                const { data } = await supabase.from('profiles').select('family_type').eq('id', user.id).single();
                setUserProfile(data);
            }
        };
        fetchProfile();
    }, []);

    // Derive context
    const context = useMemo((): QuoteContext => {
        const now = new Date();
        const month = now.getMonth() + 1;
        const hour = now.getHours();
        const temp = weather.temp;

        // Season
        let season: Season = 'winter';
        if (month >= 3 && month <= 5) season = 'spring';
        else if (month >= 6 && month <= 8) season = 'summer';
        else if (month >= 9 && month <= 11) season = 'autumn';

        // Time of Day
        let time: TimeOfDay = 'night';
        if (hour >= 4 && hour < 6) time = 'dawn';
        else if (hour >= 6 && hour < 12) time = 'morning';
        else if (hour >= 12 && hour < 17) time = 'afternoon';
        else if (hour >= 17 && hour < 21) time = 'evening';

        // Temperature Range
        let tempRange: TempRange = 'mild';
        if (temp !== null) {
            if (temp <= -10) tempRange = 'freezing';
            else if (temp <= 0) tempRange = 'cold';
            else if (temp <= 10) tempRange = 'cool';
            else if (temp <= 20) tempRange = 'mild';
            else if (temp <= 28) tempRange = 'warm';
            else if (temp <= 35) tempRange = 'hot';
            else tempRange = 'scorching';
        }

        return {
            season,
            time,
            weather: weather.type,
            tempRange,
            hasKids: userProfile?.family_type === 'family',
            isCouple: userProfile?.family_type === 'couple',
        };
    }, [weather.temp, weather.type, userProfile?.family_type]);

    // Generate quote
    useEffect(() => {
        const pick = (arr: string[]) => arr[Math.floor(Math.random() * arr.length)];

        // Priority-based quote selection
        const candidates: string[] = [];

        // 1️⃣ 극한 온도 우선
        if (context.tempRange === 'freezing') {
            candidates.push(...QUOTES.temperature.freezing);
        } else if (context.tempRange === 'scorching') {
            candidates.push(...QUOTES.temperature.scorching);
        }

        // 2️⃣ 특수 날씨
        if (context.weather === 'rainy') {
            candidates.push(...QUOTES.weather.rainy);
        } else if (context.weather === 'snowy') {
            candidates.push(...QUOTES.weather.snowy);
        } else if (context.weather === 'cloudy') {
            candidates.push(...QUOTES.weather.cloudy);
        } else if (context.weather === 'sunny') {
            candidates.push(...QUOTES.weather.sunny);
        }

        // 3️⃣ 사용자 특성
        if (context.hasKids) {
            candidates.push(...QUOTES.family.withKids);
        } else if (context.isCouple) {
            candidates.push(...QUOTES.family.couple);
        }

        // 4️⃣ 계절 + 시간대
        const seasonQuotes = QUOTES[context.season]?.[context.time];
        if (seasonQuotes) {
            candidates.push(...seasonQuotes);
        }

        // 5️⃣ 범용 문구 (항상 포함)
        candidates.push(...QUOTES.universal);

        // Pick one randomly
        if (candidates.length > 0) {
            setQuote(pick(candidates));
        }
    }, [context]);

    return {
        quote,
        context,
        weather,
    };
}
