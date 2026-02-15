
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ==========================================
// CONFIG
// ==========================================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const KMA_KEY = Deno.env.get('KMA_SERVICE_KEY') || '';
// Tour Key is not strictly needed if we reuse check-in logic, but good to have.
const TOUR_KEY = Deno.env.get('TOUR_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// STATIC RULE-BASED MEAL RECOMMENDATION
// (Copied from src/lib/meal-recommendation.ts for Deno compatibility)
// ==========================================
interface MealRecommendation {
    id: string;
    title: string;
    description: string;
    reason: string;
    tags: string[];
}

function getMealRecommendation(
    weather: { temp: number; weatherCode: string },
    memberCount: number,
    withKids: boolean = false
): MealRecommendation[] {
    const recommendations: MealRecommendation[] = [];

    // 1. Weather Based Rules
    if (weather.weatherCode === 'rainy') {
        recommendations.push({
            id: 'rain-1',
            title: '부대찌개',
            description: '소세지와 햄을 듬뿍 넣은 얼큰한 국물',
            reason: '비 오는 날, 텐트 안에서 듣는 빗소리와 따뜻한 국물은 낭만 그 자체죠.',
            tags: ['국물', '따뜻함', '소주한잔']
        });
        recommendations.push({
            id: 'rain-2',
            title: '해물파전 & 막걸리',
            description: '바삭한 파전과 시원한 막걸리 한 잔',
            reason: '타닥타닥 빗소리가 부침개 굽는 소리와 닮았대요.',
            tags: ['별미', '전', '감성']
        });
    } else if (weather.weatherCode === 'snowy' || weather.temp < 5) {
        recommendations.push({
            id: 'winter-1',
            title: '어묵탕',
            description: '김이 모락모락 나는 꼬치 어묵',
            reason: '추운 날 호호 불어가며 먹는 어묵 국물만큼 따뜻한 게 없죠.',
            tags: ['국물', '겨울', '따뜻함']
        });
        recommendations.push({
            id: 'winter-2',
            title: '군고구마 & 코코아',
            description: '난로 위에서 구운 달콤한 고구마',
            reason: '겨울 캠핑의 하이라이트는 역시 난로 간식이죠.',
            tags: ['간식', '겨울', '달콤함']
        });
    } else if (weather.temp > 28) {
        recommendations.push({
            id: 'summer-1',
            title: '냉모밀',
            description: '살얼음 동동 띄운 시원한 육수',
            reason: '더위에 지친 입맛을 살려줄 시원한 한 끼가 필요해요.',
            tags: ['시원함', '여름', '점심']
        });
        recommendations.push({
            id: 'summer-2',
            title: '수박 화채',
            description: '달콤한 수박과 탄산수의 만남',
            reason: '여름 캠핑의 무더위를 한방에 날려버릴 디저트!',
            tags: ['디저트', '시원함', '여름']
        });
    } else {
        // Normal Weather (Sunny/Cloudy)
        recommendations.push({
            id: 'normal-1',
            title: '바베큐 (삼겹살/목살)',
            description: '숯불 향 가득한 캠핑의 정석',
            reason: '캠핑의 꽃은 역시 숯불에 구워 먹는 고기죠!',
            tags: ['고기', '저녁', '필수']
        });
        recommendations.push({
            id: 'normal-2',
            title: '닭꼬치 구이',
            description: '숯불 위에서 돌려가며 익혀먹는 재미',
            reason: '맥주 한 캔 들고 불멍하며 하나씩 빼먹는 맛이 일품이에요.',
            tags: ['안주', '저녁', '간편']
        });
    }

    // 2. Kid Friendly (Top Priority if kids)
    if (withKids) {
        recommendations.unshift({
            id: 'kids-1',
            title: '소떡소떡',
            description: '휴게소보다 더 맛있는 엄마표 간식',
            reason: '아이들이 엄지 척! 들어올릴 인기 만점 간식이에요.',
            tags: ['간식', '아이들', '쉬운요리']
        });
        recommendations.unshift({
            id: 'kids-2',
            title: '카레라이스',
            description: '야채를 듬뿍 넣은 영양 만점 카레',
            reason: '신나게 뛰어놀고 밥 한 그릇 뚝딱! 아이들이 정말 좋아해요.',
            tags: ['밥', '아이들', '든든함']
        });
    }

    // 3. Group Size
    if (memberCount >= 6) {
        recommendations.push({
            id: 'group-1',
            title: '닭볶음탕',
            description: '큰 냄비에 끓여 다 같이 나눠먹는 맛',
            reason: '여럿이 둘러앉아 먹기에 이만한 메뉴가 없죠.',
            tags: ['단체', '메인요리', '칼칼함']
        });
    } else if (memberCount <= 2 && !withKids) {
        recommendations.push({
            id: 'couple-1',
            title: '감바스 알 아히요',
            description: '마늘 향 가득한 오일과 바게트',
            reason: '와인 한 잔 곁들이며 분위기 내기 딱 좋은 메뉴예요.',
            tags: ['안주', '커플', '분위기']
        });
    }

    // Default Fallback
    if (recommendations.length < 3) {
        recommendations.push({
            id: 'default-1',
            title: '라면',
            description: '밖에서 먹으면 10배 더 맛있는 라면',
            reason: '설명이 필요 없는 캠핑 요리의 진리.',
            tags: ['간단', '국물', '야식']
        });
    }

    return recommendations.slice(0, 3);
}

// ==========================================
// WEATHER & HELPER FUNCTIONS
// ==========================================
function dfs_xy_conv(code: string, v1: number, v2: number) {
    // ... (Existing KMA Grid Logic)
    const RE = 6371.00877, GRID = 5.0, SLAT1 = 30.0, SLAT2 = 60.0;
    const OLON = 126.0, OLAT = 38.0, XO = 43, YO = 136;
    const DEGRAD = Math.PI / 180.0;
    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD, slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD, olat = OLAT * DEGRAD;
    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);
    const rs: { x?: number; y?: number } = {};
    if (code === "toXY") {
        let ra = Math.tan(Math.PI * 0.25 + v1 * DEGRAD * 0.5);
        ra = re * sf / Math.pow(ra, sn);
        let theta = v2 * DEGRAD - olon;
        if (theta > Math.PI) theta -= 2.0 * Math.PI;
        if (theta < -Math.PI) theta += 2.0 * Math.PI;
        theta *= sn;
        rs.x = Math.floor(ra * Math.sin(theta) + XO + 0.5);
        rs.y = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
    }
    return rs;
}

interface DayForecast {
    date: string;
    dayOfWeek: string;
    weatherLabel: string;
    weatherEmoji: string;
    tempMin: number;
    tempMax: number;
    pop: number;
    isRainy: boolean;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const SKY_MAP: Record<string, string> = { '1': '맑음', '3': '구름많음', '4': '흐림' };
const PTY_MAP: Record<string, string> = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기' };
const EMOJI_MAP: Record<string, string> = {
    '맑음': '☀️', '구름많음': '⛅', '흐림': '☁️',
    '비': '🌧️', '비/눈': '🌨️', '눈': '❄️', '소나기': '🌦️'
};

function mockForecast(dateStr: string): DayForecast {
    const d = new Date(dateStr + 'T00:00:00+09:00');
    return {
        date: dateStr, dayOfWeek: DAY_NAMES[d.getDay()],
        weatherLabel: '정보없음', weatherEmoji: '🌤',
        tempMin: 0, tempMax: 0, pop: 0, isRainy: false
    };
}

async function getMultiDayForecast(lat: number, lng: number, dates: string[]): Promise<DayForecast[]> {
    if (!KMA_KEY) return dates.map(d => mockForecast(d));
    try {
        const grid = dfs_xy_conv("toXY", lat, lng);
        if (!grid.x || !grid.y) return dates.map(d => mockForecast(d));

        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 3600000);
        const baseDate = kst.toISOString().split('T')[0].replace(/-/g, '');
        const hour = kst.getHours();

        const baseTimes = ['2300', '2000', '1700', '1400', '1100', '0800', '0500', '0200'];
        const hourNums = [23, 20, 17, 14, 11, 8, 5, 2];
        let baseTime = '0200';
        for (let i = 0; i < hourNums.length; i++) {
            if (hour >= hourNums[i]) { baseTime = baseTimes[i]; break; }
        }

        const url = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(KMA_KEY)}&numOfRows=1000&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${grid.x}&ny=${grid.y}`;
        const resp = await fetch(url);
        const data = await resp.json();
        const items = data?.response?.body?.items?.item;
        if (!items || !Array.isArray(items)) return dates.map(d => mockForecast(d));

        const byDate: Record<string, any[]> = {};
        for (const item of items) {
            const fd = item.fcstDate;
            if (!byDate[fd]) byDate[fd] = [];
            byDate[fd].push(item);
        }

        return dates.map(dateStr => {
            const dateKey = dateStr.replace(/-/g, '');
            const dayItems = byDate[dateKey];
            if (!dayItems) return mockForecast(dateStr);

            let tmn = 999, tmx = -999, maxPop = 0, ptyAny = '0', skyAfternoon = '1';
            for (const item of dayItems) {
                const { category: cat, fcstValue: val, fcstTime: t } = item;
                if (cat === 'TMN') tmn = parseFloat(val);
                if (cat === 'TMX') tmx = parseFloat(val);
                if (cat === 'TMP') {
                    const v = parseFloat(val);
                    if (v < tmn) tmn = v;
                    if (v > tmx) tmx = v;
                }
                if (cat === 'POP') maxPop = Math.max(maxPop, parseInt(val));
                if (cat === 'SKY' && t >= '1200' && t <= '1500') skyAfternoon = val;
                if (cat === 'PTY' && val !== '0') ptyAny = val;
            }
            if (tmn === 999) tmn = tmx > -999 ? tmx - 8 : 10;
            if (tmx === -999) tmx = tmn < 999 ? tmn + 8 : 20;

            const weatherLabel = ptyAny !== '0' ? (PTY_MAP[ptyAny] || '비') : (SKY_MAP[skyAfternoon] || '맑음');
            const d = new Date(dateStr + 'T00:00:00+09:00');
            return {
                date: dateStr,
                dayOfWeek: DAY_NAMES[d.getDay()],
                weatherLabel,
                weatherEmoji: EMOJI_MAP[weatherLabel] || '🌤',
                tempMin: Math.round(tmn),
                tempMax: Math.round(tmx),
                pop: maxPop,
                isRainy: ptyAny !== '0' || maxPop > 60
            };
        });
    } catch (err) {
        console.error("[Weather] Error:", err);
        return dates.map(d => mockForecast(d));
    }
}

function formatWeatherEmotional(forecasts: DayForecast[]): string {
    const f = forecasts[0];
    if (!f) return '';
    return `${f.weatherEmoji} ${f.tempMin}°/${f.tempMax}° ${f.isRainy ? '(우산 챙기세요!)' : '(맑음)'}`;
}

// ==========================================
// MAIN
// ==========================================
serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("[Camping Reminder] Starting...");
        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 3600000);
        const today = kst.toISOString().split('T')[0];
        const tomorrowDate = new Date(kst); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toISOString().split('T')[0];
        const d4Date = new Date(kst); d4Date.setDate(d4Date.getDate() + 4);
        const d4 = d4Date.toISOString().split('T')[0];

        const { data: schedules, error } = await supabase
            .from('user_schedules')
            .select('*') // Select all for simplicity
            .in('status', ['scheduled'])
            .in('check_in', [today, tomorrow, d4]);

        if (error) throw error;
        console.log(`[Query] Found ${schedules?.length || 0} matching schedules`);

        const notifications: any[] = [];
        const updateIdsD0: string[] = [];
        const updateIdsD1: string[] = [];
        const updateIdsD4: string[] = [];

        for (const s of schedules || []) {
            const lat = s.campground_lat || 37.5665;
            const lng = s.campground_lng || 126.9780;

            // Calc Trip Dates
            const dates: string[] = [];
            let cur = new Date(s.check_in + 'T00:00:00+09:00');
            const end = new Date((s.check_out || s.check_in) + 'T00:00:00+09:00');
            console.log("Trip Range:", s.check_in, s.check_out);
            // Safety
            if (cur > end) { dates.push(s.check_in); }
            else {
                while (cur <= end) {
                    dates.push(cur.toISOString().split('T')[0]);
                    cur.setDate(cur.getDate() + 1);
                }
            }

            const forecasts = await getMultiDayForecast(lat, lng, dates);
            const weatherLine = formatWeatherEmotional(forecasts);
            const memberCount = s.member_count || 4; // Default

            // D-0: Today is the day!
            if (s.check_in === today && !s.notification_d0_sent) {
                notifications.push({
                    user_id: s.user_id,
                    category: 'schedule',
                    event_type: 'schedule_reminder',
                    title: `🏕️ 드디어 오늘이에요! 떠날 준비 되셨나요?`,
                    body: `📍 ${s.campground_name}\n${weatherLine}\n설레는 발걸음, 안전하게 다녀오세요!`,
                    data: { route: `/myspace/schedule/${s.id}` },
                    is_read: false
                });
                updateIdsD0.push(s.id);
            }
            // D-1: Meal Recommendations
            else if (s.check_in === tomorrow && !s.notification_d1_sent) {
                // Determine weather simple code for logic
                let wCode = 'sunny';
                if (forecasts[0]?.isRainy) wCode = 'rainy';
                else if (forecasts[0]?.tempMin < 5) wCode = 'snowy'; // cold

                const weatherContext = { temp: forecasts[0]?.tempMax || 20, weatherCode: wCode };
                const meals = getMealRecommendation(weatherContext, memberCount, false); // Assuming no kids info in schedule yet, default false

                const menuText = meals.map(m => `🍽️ ${m.title}: ${m.reason}`).join('\n');

                notifications.push({
                    user_id: s.user_id,
                    category: 'schedule',
                    event_type: 'schedule_reminder',
                    title: `🍳 내일 뭐 먹을지 고민되시나요?`,
                    body: `날씨에 딱 맞는 메뉴를 골라봤어요!\n\n${menuText}`,
                    data: { route: `/myspace/schedule/${s.id}` },
                    is_read: false
                });
                updateIdsD1.push(s.id);
            }
            // D-4: Gear Check
            else if (s.check_in === d4 && !s.notification_d4_sent) {
                const hasRain = forecasts.some(f => f.isRainy);
                const hasCold = forecasts.some(f => f.tempMin < 10);

                let tip = '평범한 날씨네요! 가볍게 떠나보세요.';
                if (hasRain) tip = '비 소식이 있어요 ☔ 우비와 타프 꼭 챙기세요!';
                else if (hasCold) tip = '밤에는 쌀쌀해요 🧣 따뜻한 침낭과 핫팩 잊지 마세요.';

                notifications.push({
                    user_id: s.user_id,
                    category: 'schedule',
                    event_type: 'schedule_reminder',
                    title: `🎒 캠핑이 4일 남았어요!`,
                    body: `📍 ${s.campground_name}\n${weatherLine}\n💡 ${tip}\n빠트린 물건이 없는지 체크리스트를 확인해보세요!`,
                    data: { route: `/myspace/schedule/${s.id}?tab=checklist` },
                    is_read: false
                });
                updateIdsD4.push(s.id);
            }
        }

        // Batch Insert
        if (notifications.length > 0) {
            const { error: insertError } = await supabase.from('notifications').insert(notifications);
            if (insertError) throw insertError;

            if (updateIdsD0.length > 0) await supabase.from('user_schedules').update({ notification_d0_sent: true }).in('id', updateIdsD0);
            if (updateIdsD1.length > 0) await supabase.from('user_schedules').update({ notification_d1_sent: true }).in('id', updateIdsD1);
            if (updateIdsD4.length > 0) await supabase.from('user_schedules').update({ notification_d4_sent: true }).in('id', updateIdsD4);
        }

        return new Response(JSON.stringify({
            success: true,
            count: notifications.length,
            debug: { today, tomorrow, d4 }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("Critical Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
