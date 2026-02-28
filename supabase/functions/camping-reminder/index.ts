
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

// ==========================================
// CONFIG
// ==========================================
const SUPABASE_URL = Deno.env.get('SUPABASE_URL');
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('RAON_SERVICE_ROLE_KEY') || Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
const KMA_KEY = Deno.env.get('KMA_SERVICE_KEY') || '';
const TOUR_KEY = Deno.env.get('TOUR_API_KEY') || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// ==========================================
// FIREBASE / FCM CONFIG
// ==========================================
const FIREBASE_PROJECT_ID = Deno.env.get('FIREBASE_PROJECT_ID');
const FIREBASE_CLIENT_EMAIL = Deno.env.get('FIREBASE_CLIENT_EMAIL');
const FIREBASE_PRIVATE_KEY = Deno.env.get('FIREBASE_PRIVATE_KEY')?.replace(/\\n/g, '\n');

// Import jose for JWT signing
import * as jose from "https://deno.land/x/jose@v4.14.4/index.ts";

async function getFcmAccessToken() {
    if (!FIREBASE_CLIENT_EMAIL || !FIREBASE_PRIVATE_KEY) throw new Error("Missing Firebase Credentials");
    const jwt = await new jose.SignJWT({
        iss: FIREBASE_CLIENT_EMAIL,
        scope: "https://www.googleapis.com/auth/firebase.messaging",
        aud: "https://oauth2.googleapis.com/token",
    })
        .setProtectedHeader({ alg: "RS256" })
        .setIssuedAt()
        .setExpirationTime("1h")
        .sign(await jose.importPKCS8(FIREBASE_PRIVATE_KEY, "RS256"));

    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
    });
    const data = await response.json();
    return data.access_token;
}

// ==========================================
// DB-BASED SCORING MEAL RECOMMENDATION
// ==========================================
interface Recipe {
    id: string;
    title: string;
    description: string;
    tags: string[];
    servings: string;
    metadata: any;
    _score?: number;
}

async function getScoredMenuRecommendations(
    userId: string,
    weather: { tempMin: number; tempMax: number; isRainy: boolean; weatherLabel: string },
    memberCount: number,
    count: number = 2
): Promise<Recipe[]> {
    try {
        const { data: pool, error } = await supabase
            .from('recommendation_pool')
            .select('id, title, description, tags, servings, metadata')
            .eq('category', 'cooking');

        if (error || !pool || pool.length === 0) return [];

        const isCold = weather.tempMin < 10;
        const isHot = weather.tempMax > 28;
        const isRainy = weather.isRainy;

        const month = new Date().getMonth() + 1;

        const scored = pool.map(item => {
            let score = 0;
            const tags = item.tags || [];

            if (isRainy && tags.includes('#비오는날')) score += 50;
            if (isCold && (tags.includes('#추운날') || tags.includes('#겨울') || tags.includes('#국물'))) score += 40;
            if (isHot && (tags.includes('#더운날') || tags.includes('#여름') || tags.includes('#시원한'))) score += 40;

            if (memberCount >= 4 && (tags.includes('#파티') || tags.includes('#대용량'))) score += 30;
            if (memberCount <= 2 && (tags.includes('#혼밥') || tags.includes('#커플'))) score += 30;

            if (tags.includes('#저녁')) score += 10;

            score += Math.random() * 10;
            return { ...item, _score: score };
        });

        return scored
            .sort((a, b) => (b._score || 0) - (a._score || 0))
            .slice(0, count);

    } catch (err) {
        console.error("[Menu Scoring] Error:", err);
        return [];
    }
}

// ==========================================
// TOURISM API / EVENT DISCOVERY
// ==========================================
async function getNearbyEvents(lat: number, lng: number, radiusKm: number = 30): Promise<any[]> {
    if (!TOUR_KEY) return [];

    try {
        const today = new Date();
        const kstDate = new Date(today.getTime() + 9 * 3600000);
        const todayStr = kstDate.toISOString().split('T')[0].replace(/-/g, '');

        const { data: cacheHit } = await supabase
            .from('nearby_cache')
            .select('data')
            .eq('region_code', 'ALL')
            .eq('base_date', todayStr)
            .single();

        let allEvents: any[] = [];
        if (cacheHit?.data && Array.isArray(cacheHit.data)) {
            allEvents = cacheHit.data;
        } else {
            const apiUrl = `https://apis.data.go.kr/B551011/KorService2/searchFestival2?serviceKey=${TOUR_KEY}&MobileOS=ETC&MobileApp=RAONI&_type=json&numOfRows=1000&arrange=A&eventStartDate=${todayStr}`;
            const res = await fetch(apiUrl);
            const json = await res.json();
            const items = json?.response?.body?.items?.item;
            const itemList = Array.isArray(items) ? items : (items ? [items] : []);

            allEvents = itemList.map((item: any) => ({
                title: item.title,
                addr: item.addr1,
                lat: parseFloat(item.mapy),
                lng: parseFloat(item.mapx)
            }));

            supabase.from('nearby_cache').upsert({ region_code: 'ALL', base_date: todayStr, data: allEvents }).then();
        }

        return allEvents.map(e => {
            const dist = calculateDistance(lat, lng, e.lat, e.lng);
            return { ...e, dist };
        }).filter(e => e.dist <= radiusKm)
            .sort((a, b) => a.dist - b.dist);

    } catch (err) {
        console.error("[Events] Error:", err);
        return [];
    }
}

function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
}

// ==========================================
// WEATHER HELPERS
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

async function getMultiDayForecast(lat: number, lng: number): Promise<DayForecast[]> {
    if (!KMA_KEY) return [mockForecast(new Date().toISOString().split('T')[0])];
    try {
        const grid = dfs_xy_conv("toXY", lat, lng);
        if (!grid.x || !grid.y) return [mockForecast(new Date().toISOString().split('T')[0])];

        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 3600000);
        const baseDate = kst.toISOString().split('T')[0].replace(/-/g, '');
        const hour = kst.getHours();

        // 1. Check Cache
        const { data: cacheHit } = await supabase
            .from('weather_cache')
            .select('data, updated_at')
            .eq('nx', grid.x)
            .eq('ny', grid.y)
            .single();

        // Cache is valid if updated within the last 6 hours
        const isCacheValid = cacheHit && (now.getTime() - new Date(cacheHit.updated_at).getTime() < 6 * 3600000);

        if (isCacheValid && cacheHit?.data && Array.isArray(cacheHit.data)) {
            return cacheHit.data;
        }

        // 2. Fetch from KMA
        const baseTimes = ['2300', '2000', '1700', '1400', '1100', '0800', '0500', '0200'];
        const hourNums = [23, 20, 17, 14, 11, 8, 5, 2];
        let baseTime = '0200';
        for (let i = 0; i < hourNums.length; i++) {
            if (hour >= hourNums[i]) { baseTime = baseTimes[i]; break; }
        }

        const url = `http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst?serviceKey=${encodeURIComponent(KMA_KEY)}&numOfRows=1000&pageNo=1&dataType=JSON&base_date=${baseDate}&base_time=${baseTime}&nx=${grid.x}&ny=${grid.y}`;

        // Timeout AbortController
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout per API call

        let resp;
        try {
            resp = await fetch(url, { signal: controller.signal });
            clearTimeout(timeoutId);
        } catch (fetchErr) {
            clearTimeout(timeoutId);
            console.warn(`[Weather] Fetch timeout/error for grid ${grid.x},${grid.y}. Falling back to old cache or mock.`);
            if (cacheHit?.data && Array.isArray(cacheHit.data)) return cacheHit.data;
            return [mockForecast(kst.toISOString().split('T')[0])];
        }

        const data = await resp.json();
        const items = data?.response?.body?.items?.item;

        if (!items || !Array.isArray(items)) {
            if (cacheHit?.data && Array.isArray(cacheHit.data)) return cacheHit.data;
            return [mockForecast(kst.toISOString().split('T')[0])];
        }

        const byDate: Record<string, any[]> = {};
        for (const item of items) {
            const fd = item.fcstDate;
            if (!byDate[fd]) byDate[fd] = [];
            byDate[fd].push(item);
        }

        const dayForecasts: DayForecast[] = Object.keys(byDate).map(dateKey => {
            const dayItems = byDate[dateKey];
            const dateStr = `${dateKey.substring(0, 4)}-${dateKey.substring(4, 6)}-${dateKey.substring(6, 8)}`;

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
            if (tmn === 999) tmn = 15;
            if (tmx === -999) tmx = 25;

            const weatherLabel = ptyAny !== '0' ? (PTY_MAP[ptyAny] || '비') : (SKY_MAP[skyAfternoon] || '맑음');
            return {
                date: dateStr,
                dayOfWeek: DAY_NAMES[new Date(dateStr).getDay()],
                weatherLabel,
                weatherEmoji: EMOJI_MAP[weatherLabel] || '🌤',
                tempMin: Math.round(tmn),
                tempMax: Math.round(tmx),
                pop: maxPop,
                isRainy: ptyAny !== '0' || maxPop > 60
            };
        });

        // 3. Save to Cache
        if (dayForecasts.length > 0) {
            await supabase.from('weather_cache').upsert({
                nx: grid.x,
                ny: grid.y,
                data: dayForecasts,
                updated_at: now.toISOString()
            });
        }

        return dayForecasts;
    } catch (err) {
        console.error("[Weather] Error:", err);
        return [mockForecast(new Date().toISOString().split('T')[0])];
    }
}

function mockForecast(dateStr: string): DayForecast {
    return {
        date: dateStr, dayOfWeek: '', weatherLabel: '맑음', weatherEmoji: '☀️',
        tempMin: 10, tempMax: 20, pop: 0, isRainy: false
    };
}

async function sendBulkPush(notifications: any[]) {
    if (notifications.length === 0) return;

    console.log(`[Push] Starting bulk dispatch for ${notifications.length} notifications...`);
    const accessToken = await getFcmAccessToken();

    // Chunking: Process 5 users at a time to stay safe with concurrency and rate limits
    const CHUNK_SIZE = 5;
    for (let i = 0; i < notifications.length; i += CHUNK_SIZE) {
        const chunk = notifications.slice(i, i + CHUNK_SIZE);
        await Promise.all(chunk.map(async (notif) => {
            try {
                // 1. Fetch ALL user's push tokens
                const { data: tokens } = await supabase
                    .from('push_tokens')
                    .select('token')
                    .eq('user_id', notif.user_id)
                    .eq('is_active', true)
                    .order('last_updated_at', { ascending: false });

                if (!tokens || tokens.length === 0) {
                    await supabase.from('notifications')
                        .update({ status: 'failed', error_message: 'No tokens found' })
                        .eq('id', notif.id);
                    return;
                }

                console.log(`[Push] Sending to ${tokens.length} tokens for user ${notif.user_id}...`);

                const results = await Promise.all(tokens.map(async (t) => {
                    const message = {
                        message: {
                            token: t.token,
                            notification: { title: notif.title, body: notif.body },
                            data: {
                                title: notif.title,
                                body: notif.body,
                                link: notif.data.link,
                                ...notif.data
                            },
                            webpush: {
                                fcm_options: {
                                    link: notif.data.link
                                }
                            }
                        }
                    };

                    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${FIREBASE_PROJECT_ID}/messages:send`, {
                        method: "POST",
                        headers: { "Authorization": `Bearer ${accessToken}`, "Content-Type": "application/json" },
                        body: JSON.stringify(message),
                    });

                    const resBody = await res.json();
                    return { token: t.token, status: res.status, resBody };
                }));

                // Cleanup invalid tokens
                const invalidTokens = results
                    .filter(r => {
                        const isError = r.status === 400 || r.status === 404;
                        const errCode = r.resBody?.error?.details?.[0]?.errorCode;
                        const status = r.resBody?.error?.status;
                        return isError || status === 'UNREGISTERED' || status === 'NOT_FOUND' || errCode === 'UNREGISTERED';
                    })
                    .map(r => r.token);

                if (invalidTokens.length > 0) {
                    console.log(`[CLEANUP] Pruning ${invalidTokens.length} stale tokens for user ${notif.user_id}`);
                    await supabase.from('push_tokens').delete().in('token', invalidTokens);
                }

                const successCount = results.filter(r => r.status === 200).length;
                const finalStatus = successCount > 0 ? 'sent' : 'failed';
                const resultSummary = JSON.stringify(results.map(r => ({ status: r.status, err: r.resBody?.error?.message })));

                await supabase.from('notifications')
                    .update({
                        status: finalStatus,
                        error_message: resultSummary,
                        sent_at: successCount > 0 ? new Date().toISOString() : null
                    })
                    .eq('id', notif.id);
            } catch (err) {
                console.error(`[Push Error] User ${notif.user_id}:`, err);
            }
        }));
    }
    console.log("[Push] Bulk dispatch finished.");
}

// ==========================================
// SERVE
// ==========================================
serve(async (req) => {
    if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

    try {
        const url = new URL(req.url);
        const mode = url.searchParams.get('mode') || 'dispatch';

        console.log(`[Camping Reminder] Starting execution... Mode: ${mode}`);
        const now = new Date();
        const kst = new Date(now.getTime() + 9 * 3600000);
        const today = kst.toISOString().split('T')[0];

        const tomorrowDate = new Date(kst); tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toISOString().split('T')[0];

        const d4Date = new Date(kst); d4Date.setDate(d4Date.getDate() + 4);
        const d4 = d4Date.toISOString().split('T')[0];

        const { data: schedules, error } = await supabase
            .from('user_schedules')
            .select('*')
            .in('check_in', [today, tomorrow, d4]);

        if (error) throw error;
        console.log(`[Query] Found ${schedules?.length || 0} schedules`);

        if (!schedules || schedules.length === 0) {
            return new Response(JSON.stringify({ success: true, message: "No schedules found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // ==========================================
        // PREFETCH MODE (Cache Populating)
        // ==========================================
        if (mode === 'prefetch') {
            // Extract unique locations
            const locations = new Map<string, { lat: number, lng: number }>();
            schedules.forEach(s => {
                const lat = s.campground_lat || 37.5665;
                const lng = s.campground_lng || 126.9780;
                locations.set(`${lat},${lng}`, { lat, lng });
            });

            console.log(`[Prefetch] Fetching APIs for ${locations.size} unique locations...`);

            // Prefetch nearby events (It's nationwide anyway, so doing it once)
            await getNearbyEvents(37.5665, 126.9780, 30); // Caches ALL

            // Prefetch weather in parallel but with small 3-chunk limits to be safe
            const locArray = Array.from(locations.values());
            const chunkSize = 3;
            for (let i = 0; i < locArray.length; i += chunkSize) {
                const chunk = locArray.slice(i, i + chunkSize);
                await Promise.all(chunk.map(c => getMultiDayForecast(c.lat, c.lng)));
            }

            console.log("[Prefetch] Done.");
            return new Response(JSON.stringify({ success: true, mode: 'prefetch', locations: locations.size }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // ==========================================
        // DISPATCH MODE (Queueing Notifications)
        // ==========================================
        const notifications: any[] = [];
        const updateIds: Record<string, string[]> = { d0: [], d1: [], d4: [] };

        for (const s of schedules) {
            const lat = s.campground_lat || 37.5665;
            const lng = s.campground_lng || 126.9780;

            // Gets from cache mostly, fast
            const forecasts = await getMultiDayForecast(lat, lng);
            // Default fallback if date not found in 7-day forecast
            const f = forecasts.find(x => x.date === s.check_in) || mockForecast(s.check_in);
            const weatherLine = `${f.weatherEmoji} ${f.tempMin}°/${f.tempMax}° ${f.weatherLabel}`;

            // D-0: Today is the day!
            if (s.check_in === today && !s.notification_d0_sent) {
                const events = await getNearbyEvents(lat, lng, 30);
                let eventText = "주변에 예정된 행사가 없어요~ 조용한 캠핑을 즐겨보세요!";
                if (events.length > 0) {
                    eventText = `근처에서 행사가 열리고 있어요!\n` +
                        events.slice(0, 2).map(e => `🎈 ${e.title} (${e.dist}km)`).join('\n');
                }

                notifications.push({
                    user_id: s.user_id,
                    category: 'reservation',
                    event_type: 'upcoming_stay_today',
                    title: `🏕️ 드디어 오늘이에요! 떠날 준비 되셨나요?`,
                    body: `📍 ${s.campground_name}\n${weatherLine}\n\n${eventText}\n설레는 발걸음, 안전하게 다녀오세요!`,
                    data: { link: `/myspace/schedule/${s.id}` },
                    status: 'queued'
                });
                updateIds.d0.push(s.id);
            }
            // D-1: Meal Recommendations
            else if (s.check_in === tomorrow && !s.notification_d1_sent) {
                const meals = await getScoredMenuRecommendations(s.user_id, f, s.member_count || 2);
                const menuText = meals.length > 0
                    ? meals.map(m => `🍽️ ${m.title}`).join(', ')
                    : "캠핑장에서 즐기기 좋은 맛있는 요리";

                notifications.push({
                    user_id: s.user_id,
                    category: 'reservation',
                    event_type: 'upcoming_stay_d1',
                    title: `🍳 내일 뭐 먹을지 고민되시나요?`,
                    body: `날씨에 딱 맞는 메뉴를 골라봤어요!\n\n추천 메뉴: ${menuText}\n\n레시피가 궁금하다면 확인해보세요!`,
                    data: { link: `/myspace/schedule/${s.id}?tab=checklist` },
                    status: 'queued'
                });
                updateIds.d1.push(s.id);
            }
            // D-4: Gear Check
            else if (s.check_in === d4 && !s.notification_d4_sent) {
                let tip = '평범한 날씨네요! 가볍게 떠나보세요.';
                if (f.isRainy) tip = '비 소식이 있어요 ☔ 우비와 타프 꼭 챙기세요!';
                else if (f.tempMin < 10) tip = '밤에는 쌀쌀해요 🧣 따뜻한 침낭과 핫팩 잊지 마세요.';

                notifications.push({
                    user_id: s.user_id,
                    category: 'reservation',
                    event_type: 'upcoming_stay_d4', // Fixed type
                    title: `🎒 캠핑이 4일 남았어요!`,
                    body: `📍 ${s.campground_name}\n${weatherLine}\n💡 ${tip}\n\n빠트린 물건이 없는지 체크리스트를 확인해보세요!`,
                    data: { link: `/myspace/schedule/${s.id}?tab=checklist` },
                    status: 'queued' // Fixed status
                });
                updateIds.d4.push(s.id);
            }
        }

        // Finalize
        if (notifications.length > 0) {
            const { data: inserted, error: insertError } = await supabase
                .from('notifications')
                .insert(notifications)
                .select();

            if (insertError) {
                console.error("Failed to insert notifications:", insertError);
            } else if (inserted) {
                console.log(`Successfully queued ${inserted.length} notifications.`);
                // Trigger direct dispatch for these notifications
                sendBulkPush(inserted).then(); // Run in background
            }
        }

        if (updateIds.d0.length > 0) await supabase.from('user_schedules').update({ notification_d0_sent: true }).in('id', updateIds.d0);
        if (updateIds.d1.length > 0) await supabase.from('user_schedules').update({ notification_d1_sent: true }).in('id', updateIds.d1);
        if (updateIds.d4.length > 0) await supabase.from('user_schedules').update({ notification_d4_sent: true }).in('id', updateIds.d4);

        return new Response(JSON.stringify({ success: true, mode: 'dispatch', count: notifications.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("Critical Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
