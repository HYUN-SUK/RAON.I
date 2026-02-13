
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ==========================================
// CONFIG
// ==========================================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const KMA_KEY = Deno.env.get('KMA_SERVICE_KEY') || '';
const TOUR_KEY = Deno.env.get('TOUR_API_KEY') || '';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// KMA COORDINATE CONVERSION
// ==========================================
function dfs_xy_conv(code: string, v1: number, v2: number) {
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

// ==========================================
// WEATHER: KMA 단기예보 API
// ==========================================
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
    if (!KMA_KEY) {
        console.log("[Weather] No KMA_KEY, using mock");
        return dates.map(d => mockForecast(d));
    }
    try {
        const grid = dfs_xy_conv("toXY", lat, lng);
        if (!grid.x || !grid.y) return dates.map(d => mockForecast(d));

        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 3600000);
        const baseDate = kst.toISOString().split('T')[0].replace(/-/g, '');
        const hour = kst.getHours();
        // 가장 최신 발표 시간 사용
        const baseTimes = ['2300', '2000', '1700', '1400', '1100', '0800', '0500', '0200'];
        const hourNums = [23, 20, 17, 14, 11, 8, 5, 2];
        let baseTime = '0200';
        for (let i = 0; i < hourNums.length; i++) {
            if (hour >= hourNums[i]) { baseTime = baseTimes[i]; break; }
        }

        const url = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(KMA_KEY)}&numOfRows=1000&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${grid.x}&ny=${grid.y}`;
        console.log(`[Weather] KMA API call: baseDate=${baseDate}, baseTime=${baseTime}`);

        const resp = await fetch(url);
        const data = await resp.json();
        const items = data?.response?.body?.items?.item;
        if (!items || !Array.isArray(items)) {
            console.log("[Weather] No items from KMA, response:", JSON.stringify(data?.response?.header));
            return dates.map(d => mockForecast(d));
        }

        // Group items by fcstDate
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

function formatWeatherLine(forecasts: DayForecast[]): string {
    return '🌤 ' + forecasts.map(f =>
        `${f.dayOfWeek} ${f.weatherLabel} ${f.tempMin}°/${f.tempMax}°`
    ).join(' | ');
}

// ==========================================
// TOUR API: 주변 행사/축제
// ==========================================
interface NearbyEvent { title: string; addr: string; dist: string; }

async function getNearbyEvents(lat: number, lng: number): Promise<NearbyEvent[]> {
    if (!TOUR_KEY) {
        console.log("[Tour] No TOUR_API_KEY, skipping");
        return [];
    }
    try {
        const url = `http://apis.data.go.kr/B551011/KorService1/locationBasedList1?serviceKey=${encodeURIComponent(TOUR_KEY)}&numOfRows=3&pageNo=1&MobileOS=ETC&MobileApp=RAONI&_type=json&mapX=${lng}&mapY=${lat}&radius=30000&listYN=Y&arrange=E&contentTypeId=15`;
        console.log(`[Tour] API call: lat=${lat}, lng=${lng}`);
        const resp = await fetch(url);
        const data = await resp.json();
        const items = data?.response?.body?.items?.item;
        if (!items) return [];
        const arr = Array.isArray(items) ? items : [items];
        return arr.map((e: any) => ({
            title: e.title || '',
            addr: e.addr1 || '',
            dist: (parseFloat(e.dist || '0') / 1000).toFixed(1)
        }));
    } catch (err) {
        console.error("[Tour] Error:", err);
        return [];
    }
}

function formatEventsLine(events: NearbyEvent[]): string {
    if (events.length === 0) return '🎪 주변 행사: 정보 없음';
    return '🎪 주변행사: ' + events.map(e => `${e.title} (${e.dist}km)`).join(', ');
}

// ==========================================
// WEATHER-BASED GEAR RECOMMENDATIONS
// ==========================================
function getWeatherGear(forecasts: DayForecast[]): string[] {
    const gear: string[] = [];
    const hasRain = forecasts.some(f => f.isRainy);
    const hasCold = forecasts.some(f => f.tempMin < 5);
    const hasCool = forecasts.some(f => f.tempMin < 10);
    const hasHot = forecasts.some(f => f.tempMax > 30);

    if (hasRain) gear.push('우비', '타프', '김장봉투', '방수매트');
    if (hasCold) gear.push('핫팩', '동계침낭', '전기장판', '방한의류');
    else if (hasCool) gear.push('따뜻한 침낭', '긴팔 여벌', '담요');
    if (hasHot) gear.push('선풍기', '모기장', '쿨매트', '선크림');
    if (!hasRain && !hasCold && !hasCool && !hasHot) gear.push('선크림', '그늘막', '선글라스');
    return gear;
}

// ==========================================
// MEAL RATIONALE: 4-Slot Literary Generator
// ==========================================
const OPENINGS = [
    "캠핑의 낭만은 역시 먹는 거죠,",
    "자연 속에서 즐기는,",
    "텐트 밖 풍경과 함께,",
    "모닥불 옆에서,",
    "하늘 아래에서 먹는 밥은 다르죠,",
    "불멍 하며 느끼는,",
    "캠핑장의 밤은 특별하죠,",
    "감성 가득한 캠핑장에서,",
    "지금 이 순간,",
    "숲속의 고요함 속에서,"
];

function getWeatherPhrase(f: DayForecast): string {
    if (f.isRainy) return ["비 오는 날엔", "빗소리와 함께", "촉촉한 비가 오는 날"][Math.floor(Math.random() * 3)];
    if (f.tempMin < 5) return ["쌀쌀한 겨울 밤에", "손끝이 시린 추위 속에", "차가운 공기 속에서"][Math.floor(Math.random() * 3)];
    if (f.tempMin < 10) return ["선선한 바람이 불 때", "쌀쌀한 저녁에", "가을 바람이 부는"][Math.floor(Math.random() * 3)];
    if (f.tempMax > 30) return ["뜨거운 여름 한낮에", "시원한 한 잔이 생각나는 날", "더위를 날릴"][Math.floor(Math.random() * 3)];
    return ["맑은 하늘 아래", "산들바람이 부는", "별이 쏟아지는 밤에"][Math.floor(Math.random() * 3)];
}

function getDayPhrase(dayIndex: number, totalDays: number): string {
    if (dayIndex === 0) return ["첫날의 설렘을 담은", "시작은 든든하게,", "기대감 가득한 첫 끼니,"][Math.floor(Math.random() * 3)];
    if (dayIndex === totalDays - 1) return ["마지막 밤의 특별한", "아쉬운 마지막 날,", "돌아가기 전 마지막 만찬,"][Math.floor(Math.random() * 3)];
    return ["캠핑의 여유를 만끽하며,", "느긋한 오후에 어울리는,", "한낮의 즐거움을 더해줄,"][Math.floor(Math.random() * 3)];
}

function getClosing(meal: any): string {
    const closings = [
        `${meal.title} 어떠세요?`,
        `${meal.title}이(가) 완벽해요.`,
        `${meal.title}을(를) 추천해요!`,
        `${meal.title}으로 결정!`,
    ];
    return closings[Math.floor(Math.random() * closings.length)];
}

function generateMealRationale(meal: any, forecast: DayForecast, dayIndex: number, totalDays: number): string {
    const wp = getWeatherPhrase(forecast);
    const dp = getDayPhrase(dayIndex, totalDays);
    return `${wp} ${dp} ${getClosing(meal)}`;
}

// ==========================================
// MEAL RECOMMENDATION
// ==========================================
async function recommendMealsWithRationale(
    supabase: any,
    context: { weather: string; temp?: number; memberCount: number; dateStr?: string },
    forecasts: DayForecast[]
) {
    let season = 'spring';
    if (context.dateStr) {
        const m = new Date(context.dateStr).getMonth() + 1;
        if (m >= 3 && m <= 5) season = 'spring';
        else if (m >= 6 && m <= 8) season = 'summer';
        else if (m >= 9 && m <= 11) season = 'autumn';
        else season = 'winter';
    }

    const { data: pool } = await supabase.from('recommendation_pool').select('*').eq('category', 'cooking');
    if (!pool || pool.length === 0) return [];

    const hasTag = (item: any, tag: string) => {
        if (!item?.tags) return false;
        if (Array.isArray(item.tags)) return item.tags.includes(tag);
        if (typeof item.tags === 'string') return item.tags.includes(tag);
        return false;
    };

    // Build per-day recommendations
    const tripDays = forecasts.length || context.memberCount || 3;
    const results: { title: string; rationale: string; id: any }[] = [];
    const usedIds = new Set();

    for (let i = 0; i < tripDays; i++) {
        const dayForecast = forecasts[i] || forecasts[forecasts.length - 1] || mockForecast(context.dateStr || '');
        let filtered = pool.filter((p: any) => !usedIds.has(p.id));
        if (filtered.length === 0) filtered = pool;

        // Weather-based filtering
        if (dayForecast.isRainy || dayForecast.tempMin < 10) {
            const warm = filtered.filter((it: any) => hasTag(it, '#국물') || hasTag(it, '#따뜻한') || hasTag(it, '#전골') || hasTag(it, '#찌개'));
            if (warm.length > 0) filtered = [...warm, ...warm, ...filtered]; // double weight
        } else if (dayForecast.tempMax > 30) {
            const cool = filtered.filter((it: any) => hasTag(it, '#이열치열') || !hasTag(it, '#국물'));
            if (cool.length > 0) filtered = cool;
        }

        // Group-based filtering
        if (context.memberCount > 2) {
            const group = filtered.filter((it: any) => hasTag(it, '#파티') || hasTag(it, '#전골') || hasTag(it, '#메인요리'));
            if (group.length > 0) filtered = group;
        }

        const pick = filtered[Math.floor(Math.random() * filtered.length)];
        if (pick) {
            usedIds.add(pick.id);
            results.push({
                title: pick.title + (pick.subtitle ? ` (${pick.subtitle})` : ''),
                rationale: generateMealRationale(pick, dayForecast, i, tripDays),
                id: pick.id
            });
        }
    }
    return results;
}

// ==========================================
// HELPER: Date Range
// ==========================================
function getDateRange(start: string, end: string): string[] {
    const dates: string[] = [];
    const s = new Date(start + 'T00:00:00+09:00');
    const e = new Date(end + 'T00:00:00+09:00');
    const cur = new Date(s);
    while (cur <= e) {
        dates.push(cur.toISOString().split('T')[0]);
        cur.setDate(cur.getDate() + 1);
    }
    return dates;
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

        // 1. Calculate KST dates
        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 3600000);
        const today = kst.toISOString().split('T')[0];
        const tomorrowDate = new Date(kst); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toISOString().split('T')[0];
        const d4Date = new Date(kst); d4Date.setDate(d4Date.getDate() + 4);
        const d4 = d4Date.toISOString().split('T')[0];

        console.log(`[Dates] Today=${today}, Tomorrow=${tomorrow}, D4=${d4}`);

        // 2. Query schedules
        const { data: schedules, error } = await supabase
            .from('user_schedules')
            .select('id, user_id, campground_name, check_in, check_out, campground_lat, campground_lng, notification_d0_sent, notification_d1_sent, notification_d4_sent, member_count')
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
            const tripDates = getDateRange(s.check_in, s.check_out || s.check_in);
            const forecasts = await getMultiDayForecast(lat, lng, tripDates);
            const weatherLine = formatWeatherLine(forecasts);
            const memberCount = s.member_count || (tripDates.length);

            // ==================== D-Day ====================
            if (s.check_in === today && !s.notification_d0_sent) {
                const events = await getNearbyEvents(lat, lng);
                const eventsLine = formatEventsLine(events);

                notifications.push({
                    user_id: s.user_id,
                    category: 'schedule',
                    event_type: 'schedule_reminder',
                    title: `오늘이 캠핑 떠나는 날! ⛺`,
                    body: `📍 ${s.campground_name}\n${weatherLine}\n${eventsLine}\n즐거운 캠핑 되세요! 안전운전하세요! 🚗`,
                    data: { route: `/myspace/schedule/${s.id}` },
                    is_read: false
                });
                updateIdsD0.push(s.id);
            }
            // ==================== D-1 ====================
            else if (s.check_in === tomorrow && !s.notification_d1_sent) {
                const meals = await recommendMealsWithRationale(
                    supabase,
                    { weather: forecasts[0]?.weatherLabel || '맑음', temp: forecasts[0]?.tempMax, memberCount, dateStr: tomorrow },
                    forecasts
                );

                const menuLines = meals.map((m, i) =>
                    `🍳 [${i + 1}일차] ${m.title}\n   — "${m.rationale}"`
                ).join('\n');

                notifications.push({
                    user_id: s.user_id,
                    category: 'schedule',
                    event_type: 'schedule_reminder',
                    title: `내일 캠핑! 메뉴 추천 (${tripDates.length - 1}박${tripDates.length}일) 🍳`,
                    body: `📍 ${s.campground_name}\n${weatherLine}\n${menuLines}`,
                    data: {
                        route: `/myspace/schedule/${s.id}?tab=checklist&recipeId=${meals[0]?.id}`,
                        recipeId: meals[0]?.id
                    },
                    is_read: false
                });
                updateIdsD1.push(s.id);
            }
            // ==================== D-4 ====================
            else if (s.check_in === d4 && !s.notification_d4_sent) {
                const gear = getWeatherGear(forecasts);
                const gearLine = gear.length > 0 ? `🎒 핵심장비: ${gear.join(', ')}` : '';
                const rainNote = forecasts.some(f => f.isRainy) ? ' (비 예보 있음 ☔)' : '';

                notifications.push({
                    user_id: s.user_id,
                    category: 'schedule',
                    event_type: 'schedule_reminder',
                    title: `캠핑 4일 전! 준비를 시작해볼까요? 📋`,
                    body: `📍 ${s.campground_name}\n${weatherLine}\n${gearLine}${rainNote}\n체크리스트를 확인해보세요!`,
                    data: { route: `/myspace/schedule/${s.id}?tab=checklist` },
                    is_read: false
                });
                updateIdsD4.push(s.id);
            }
        }

        // 3. Batch Insert & Update Flags
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
            notifications: notifications.map(n => ({ title: n.title, body: n.body })),
            debug: { today, tomorrow, d4, processedIds: [...updateIdsD0, ...updateIdsD1, ...updateIdsD4] }
        }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        console.error("Critical Error:", err);
        return new Response(JSON.stringify({ error: err.message, stack: err.stack }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
