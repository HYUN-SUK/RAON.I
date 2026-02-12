
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.7.1";

// ==========================================
// UTILS (Merged from utils.ts)
// ==========================================

// KMA Coordinate Conversion
export function dfs_xy_conv(code: string, v1: number, v2: number) {
    const RE = 6371.00877; // 地球半径(km)
    const GRID = 5.0; // 格子間隔(km)
    const SLAT1 = 30.0; // 投射緯度1(degree)
    const SLAT2 = 60.0; // 投射緯度2(degree)
    const OLON = 126.0; // 基準点経度(degree)
    const OLAT = 38.0; // 基準点緯度(degree)
    const XO = 43; // 基準点X座標(GRID)
    const YO = 136; // 基準点Y座標(GRID)

    const DEGRAD = Math.PI / 180.0;
    const RADDEG = 180.0 / Math.PI;

    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);

    interface Result {
        lat?: number;
        lng?: number;
        x?: number;
        y?: number;
    }
    const rs: Result = {};

    if (code === "toXY") {
        rs.lat = v1;
        rs.lng = v2;
        let ra = Math.tan(Math.PI * 0.25 + (v1) * DEGRAD * 0.5);
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

// Fetch Weather (Simplified)
export async function getForecast(lat: number, lng: number, dateStr: string) {
    const KMA_KEY = "03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2";
    // if (!KMA_KEY) return null; // Relaxed for bundled version to allow testing without keys

    // Convert Lat/Lng to Grid
    const grid = dfs_xy_conv("toXY", lat, lng);
    if (!grid.x || !grid.y) return null;

    // Mock data for now
    return {
        temp_min: 15,
        temp_max: 25,
        sky: 'Sunny', // 맑음
        pop: 0
    };
}

// Fetch Nearby Events
export async function getNearbyEvents(lat: number, lng: number, dateStr: string) {
    const TOUR_KEY = "03e41a022f4e6033f803beff860f41460f071cc9482e2532db99c142505f9df2";
    if (!TOUR_KEY) return [];
    return [];
}

// Recommend Meals
// Recommend Meals
export async function recommendMeals(supabase: any, context: { season?: string, weather: string, temp?: number, memberCount: number, dateStr?: string }) {
    // 1. Determine Season
    let season = context.season;
    if (!season && context.dateStr) {
        const month = new Date(context.dateStr).getMonth() + 1;
        if (month >= 3 && month <= 5) season = 'spring';
        else if (month >= 6 && month <= 8) season = 'summer';
        else if (month >= 9 && month <= 11) season = 'autumn';
        else season = 'winter';
    }

    // 2. Fetch Pool
    const { data: pool } = await supabase
        .from('recommendation_pool')
        .select('*')
        .eq('category', 'cooking');

    if (!pool || pool.length === 0) return [];

    let filtered = pool;

    // 3. Filter by Season
    if (season) {
        const seasonMatches = filtered.filter((item: any) => {
            if (!item.metadata || !item.metadata.season) return true;
            return item.metadata.season.includes(season);
        });
        if (seasonMatches.length > 0) filtered = seasonMatches;
    }

    // 4. Filter by Weather & Temperature
    const isRainy = context.weather.toLowerCase().includes('rain') || context.weather.toLowerCase().includes('cloud') || context.weather.toLowerCase().includes('snow');
    const isCold = (context.temp !== undefined && context.temp < 10);
    const isHot = (context.temp !== undefined && context.temp > 30);

    if (isRainy || isCold) {
        const warmFood = filtered.filter((item: any) =>
            (item.metadata?.weather && item.metadata.weather.includes('rainy')) ||
            item.tags?.includes('#국물') ||
            item.tags?.includes('#따뜻한') ||
            item.tags?.includes('#전골') ||
            item.tags?.includes('#찌개')
        );
        if (warmFood.length > 0) {
            // Mix warm food with others, but give warm food higher chance
            const others = filtered.filter((item: any) => !warmFood.includes(item));
            filtered = [...warmFood, ...warmFood, ...others]; // Double weight
        }
    } else if (isHot) {
        const coolFood = filtered.filter((item: any) =>
            item.tags?.includes('#이열치열') ||
            !item.tags?.includes('#국물')
        );
        if (coolFood.length > 0) filtered = coolFood;
    }

    // 5. Filter by User Characteristics (Member Count)
    // Group/Family (>2) vs Solo/Couple (<=2)
    if (context.memberCount > 2) {
        const groupFood = filtered.filter((item: any) =>
            item.tags?.includes('#파티') ||
            item.tags?.includes('#전골') ||
            item.tags?.includes('#메인요리') ||
            parseInt(item.servings) >= 3
        );
        if (groupFood.length > 0) filtered = groupFood;
    } else {
        const soloFood = filtered.filter((item: any) =>
            item.tags?.includes('#간단') ||
            item.tags?.includes('#안주') ||
            item.tags?.includes('#분위기') ||
            parseInt(item.servings) <= 2
        );
        if (soloFood.length > 0) filtered = soloFood;
    }

    // 6. Randomize & Slice
    // If filtered became empty (too strict), fallback to pool
    if (filtered.length === 0) filtered = pool;

    const count = context.memberCount || 3;
    const shuffled = filtered.sort(() => 0.5 - Math.random());
    // Ensure unique items if we duplicated for weight
    const unique = Array.from(new Set(shuffled));
    return unique.slice(0, count);
}

// ==========================================
// MAIN FUNCTION
// ==========================================

const SUPABASE_URL = "https://khqiqwtoyvesxahsjukk.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImtocWlxd3RveXZlc3hhaHNqdWtrIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc2NTgzOTYwNSwiZXhwIjoyMDgxNDE1NjA1fQ.EKpyz8NvGZLbmTPn4m_-PZNeDD4GgcpzlqPDdY1inHI";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
    if (req.method === 'OPTIONS') {
        return new Response('ok', { headers: corsHeaders });
    }

    try {
        console.log("[Camping Reminder] Starting cron job...");

        // 1. Calculate KST Dates
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(now.getTime() + kstOffset);
        const today = kstDate.toISOString().split('T')[0];

        const tomorrowDate = new Date(kstDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toISOString().split('T')[0];

        const d4Date = new Date(kstDate);
        d4Date.setDate(d4Date.getDate() + 4);
        const d4 = d4Date.toISOString().split('T')[0];

        // 2. Query Schedules (Added check_out, member_count)
        const { data: schedules, error } = await supabase
            .from('user_schedules')
            .select('id, user_id, campground_name, check_in, check_out, campground_lat, campground_lng, notification_d0_sent, notification_d1_sent, notification_d4_sent, member_count')
            .in('status', ['scheduled'])
            .in('check_in', [today, tomorrow, d4]);

        if (error) throw error;

        const notifications = [];
        const updateIdsD0: string[] = [];
        const updateIdsD1: string[] = [];
        const updateIdsD4: string[] = [];

        for (const schedule of schedules || []) {
            const lat = schedule.campground_lat || 37.5665; // Default Seoul
            const lng = schedule.campground_lng || 126.9780;

            // D-Day (Today)
            if (schedule.check_in === today && !schedule.notification_d0_sent) {
                const weather = await getForecast(lat, lng, today);
                const weatherStr = weather ? `${weather.sky}, ${weather.temp_max}°C` : '';

                notifications.push({
                    user_id: schedule.user_id,
                    type: 'schedule',
                    title: `오늘이 캠핑 떠나는 날! ⛺ ${weatherStr}`,
                    body: `즐거운 캠핑 되세요! '${schedule.campground_name}'에서의 추억을 기대할게요. 안전운전하세요!`,
                    data: { route: `/myspace/schedule/${schedule.id}` },
                    is_read: false
                });
                updateIdsD0.push(schedule.id);
            }
            // D-1 (Tomorrow)
            else if (schedule.check_in === tomorrow && !schedule.notification_d1_sent) {
                const weather = await getForecast(lat, lng, tomorrow);

                // Calculate Duration (Days)
                const start = new Date(schedule.check_in);
                const end = new Date(schedule.check_out);
                const diffTime = Math.abs(end.getTime() - start.getTime());
                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                const tripDuration = diffDays + 1; // 1박2일 = 2일치, 2박3일 = 3일치

                // Recommend Meals (1 per day)
                const meals = await recommendMeals(supabase, { season: undefined, weather: weather?.sky || 'Clear', temp: weather?.temp_max, memberCount: tripDuration, dateStr: tomorrow });

                // Format: [1일차] 메뉴A / [2일차] 메뉴B ...
                const menuStr = meals.map((m: any, i: number) => {
                    return `[${i + 1}일차] ${m.title}`;
                }).join(' / ');

                notifications.push({
                    user_id: schedule.user_id,
                    type: 'schedule',
                    title: `내일 캠핑, 식사 메뉴 추천! (${tripDuration}일)`,
                    body: `날씨: ${weather?.sky || '맑음'}. 추천: ${menuStr}`,
                    data: { route: `/myspace/schedule/${schedule.id}?tab=checklist&recipeId=${meals[0]?.id}`, recipeId: meals[0]?.id },
                    is_read: false
                });
                updateIdsD1.push(schedule.id);
            }
            // D-4 (4 Days later)
            else if (schedule.check_in === d4 && !schedule.notification_d4_sent) {
                const weather = await getForecast(lat, lng, d4);
                const isRainy = weather?.sky?.includes('Rain') || weather?.pop > 50;

                let msg = `체크리스트를 작성해보세요.`;
                if (isRainy) msg = `비 소식이 있어요 ☔ 우중캠핑 준비물(우비, 김장봉투)을 챙겨보세요.`;

                notifications.push({
                    user_id: schedule.user_id,
                    type: 'schedule',
                    title: `캠핑 4일 전! ${isRainy ? '우비 챙기셨나요?' : '준비를 시작해볼까요?'}`,
                    body: `'${schedule.campground_name}' 여행 가기 전, ${msg}`,
                    data: { route: `/myspace/schedule/${schedule.id}?tab=checklist` },
                    is_read: false
                });
                updateIdsD4.push(schedule.id);
            }
        }

        // 3. Batch Insert Notifications & Update Flags
        if (notifications.length > 0) {
            await supabase.from('notifications').insert(notifications);

            if (updateIdsD0.length > 0) await supabase.from('user_schedules').update({ notification_d0_sent: true }).in('id', updateIdsD0);
            if (updateIdsD1.length > 0) await supabase.from('user_schedules').update({ notification_d1_sent: true }).in('id', updateIdsD1);
            if (updateIdsD4.length > 0) await supabase.from('user_schedules').update({ notification_d4_sent: true }).in('id', updateIdsD4);
        }

        return new Response(JSON.stringify({ success: true, count: notifications.length }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

    } catch (err: any) {
        return new Response(JSON.stringify({ error: err.message }), {
            status: 500,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
    }
});
