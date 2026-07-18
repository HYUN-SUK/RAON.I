
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

        const scored = pool.map((item: any) => {
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
            .sort((a: any, b: any) => (b._score || 0) - (a._score || 0))
            .slice(0, count);

    } catch (err) {
        console.error("[Menu Scoring] Error:", err);
        return [];
    }
}

// ==========================================
// DB-BASED SCORING GEAR RECOMMENDATION
// ==========================================
async function getScoredGearRecommendations(
    weather: { tempMin: number; isRainy: boolean; tempMax: number },
    count: number = 2
): Promise<any[]> {
    try {
        const { data: pool, error } = await supabase
            .from('recommendation_pool')
            .select('title, description, tags')
            .eq('category', 'play')
            .contains('tags', JSON.stringify(['#gear']));

        if (error || !pool || pool.length === 0) return [];

        const isCold = weather.tempMin < 10;
        const isHot = weather.tempMax > 28;
        const isRainy = weather.isRainy;

        const scored = pool.map((item: any) => {
            let score = 0;
            const tags = item.tags || [];

            if (isRainy && (tags.includes('#비오는날') || tags.includes('#우중캠핑'))) score += 100;
            if (isCold && (tags.includes('#추운날') || tags.includes('#겨울') || tags.includes('#동계캠핑'))) score += 100;
            if (isHot && (tags.includes('#더운날') || tags.includes('#여름') || tags.includes('#폭염'))) score += 100;
            if (!isRainy && !isCold && !isHot && tags.includes('#맑음')) score += 50;

            score += Math.random() * 10;
            return { ...item, _score: score };
        });

        return scored
            .sort((a: any, b: any) => (b._score || 0) - (a._score || 0))
            .slice(0, count);

    } catch (err) {
        console.error("[Gear Scoring] Error:", err);
        return [];
    }
}

// ==========================================
// TOURISM API / EVENT DISCOVERY
// ==========================================
async function getNearbyEvents(lat: number, lng: number, radiusKm: number = 30, tripStart?: string, tripEnd?: string): Promise<any[]> {
    if (!TOUR_KEY) return [];

    try {
        const today = new Date();
        const kstDate = new Date(today.getTime() + 9 * 3600000);
        const todayStr = kstDate.toISOString().split('T')[0].replace(/-/g, '');
        const startStr = tripStart ? tripStart.replace(/-/g, '') : '';
        const endStr = tripEnd ? tripEnd.replace(/-/g, '') : '';

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
                lng: parseFloat(item.mapx),
                startDate: item.eventstartdate,
                endDate: item.eventenddate
            }));

            supabase.from('nearby_cache').upsert({ region_code: 'ALL', base_date: todayStr, data: allEvents }).then();
        }

        return allEvents.map(e => {
            const dist = calculateDistance(lat, lng, e.lat, e.lng);
            return { ...e, dist };
        }).filter(e => {
            const isWithinRadius = e.dist <= radiusKm;
            if (!isWithinRadius) return false;

            if (startStr && endStr && e.startDate && e.endDate) {
                return !(e.endDate < startStr || e.startDate > endStr);
            }
            return true;
        }).sort((a, b) => a.dist - b.dist);

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
// REGION ID HELPERS (Mid-term Forecast)
// ==========================================
// KMA Mid-term Land Forecast Regions (wf3~wf10)
const MID_LAND_REGIONS: { id: string; name: string; bounds: { minLat: number; maxLat: number; minLng: number; maxLng: number } }[] = [
    { id: '11B00000', name: '서울, 인천, 경기도', bounds: { minLat: 36.8, maxLat: 38.3, minLng: 126.0, maxLng: 127.8 } },
    { id: '11D10000', name: '강원도 영서', bounds: { minLat: 37.0, maxLat: 38.6, minLng: 127.5, maxLng: 128.5 } },
    { id: '11D20000', name: '강원도 영동', bounds: { minLat: 37.0, maxLat: 38.6, minLng: 128.5, maxLng: 130.0 } },
    { id: '11C20000', name: '대전, 세종, 충청남도', bounds: { minLat: 35.9, maxLat: 37.0, minLng: 125.8, maxLng: 127.6 } },
    { id: '11C10000', name: '충청북도', bounds: { minLat: 36.0, maxLat: 37.2, minLng: 127.4, maxLng: 128.8 } },
    { id: '11F20000', name: '광주, 전라남도', bounds: { minLat: 34.0, maxLat: 35.5, minLng: 125.5, maxLng: 127.8 } },
    { id: '11F10000', name: '전라북도', bounds: { minLat: 35.3, maxLat: 36.2, minLng: 125.8, maxLng: 127.9 } },
    { id: '11H10000', name: '대구, 경상북도', bounds: { minLat: 35.5, maxLat: 37.1, minLng: 127.8, maxLng: 129.6 } },
    { id: '11H20000', name: '부산, 울산, 경상남도', bounds: { minLat: 34.5, maxLat: 35.8, minLng: 127.5, maxLng: 129.5 } },
    { id: '11G00000', name: '제주도', bounds: { minLat: 33.1, maxLat: 34.0, minLng: 126.1, maxLng: 127.0 } }
];

// Reference cities with coordinates for exact temperature matching (taMin, taMax)
const MID_TA_REGIONS: { id: string; name: string; lat: number; lng: number }[] = [
    { id: '11B10101', name: '서울', lat: 37.5665, lng: 126.9780 },
    { id: '11B20201', name: '인천', lat: 37.4563, lng: 126.7052 },
    { id: '11B20601', name: '수원', lat: 37.2636, lng: 127.0286 },
    { id: '11B20605', name: '가평', lat: 37.8315, lng: 127.5095 }, // popular camping
    { id: '11D10301', name: '춘천', lat: 37.8813, lng: 127.7298 },
    { id: '11D10401', name: '원주', lat: 37.3422, lng: 127.9202 },
    { id: '11D20501', name: '강릉', lat: 37.7519, lng: 128.8761 },
    { id: '11C20401', name: '홍성(예산)', lat: 36.6010, lng: 126.6607 },
    { id: '11C20404', name: '서산', lat: 36.7845, lng: 126.4503 }, // Taean area
    { id: '11C10301', name: '청주', lat: 36.6424, lng: 127.4890 },
    { id: '11F20501', name: '광주', lat: 35.1595, lng: 126.8526 },
    { id: '11F10201', name: '전주', lat: 35.8242, lng: 127.1480 },
    { id: '11H10701', name: '대구', lat: 35.8714, lng: 128.6014 },
    { id: '11H20201', name: '부산', lat: 35.1796, lng: 129.0756 },
    { id: '11G00201', name: '제주', lat: 33.4996, lng: 126.5312 },
    { id: '11G00401', name: '서귀포', lat: 33.2541, lng: 126.5601 }
];

function getMidTermRegionCodes(lat: number, lng: number): { landRegId: string; taRegId: string } {
    let landRegId = '11C20000'; // Default Chungnam
    // 1. Find Land Region (Weather state)
    for (const r of MID_LAND_REGIONS) {
        if (lat >= r.bounds.minLat && lat <= r.bounds.maxLat && lng >= r.bounds.minLng && lng <= r.bounds.maxLng) {
            landRegId = r.id;
            break;
        }
    }

    // 2. Find Nearest Temperature Reference City (Temperature state)
    let taRegId = '11C20401'; // Default Hongseong/Yesan
    let minDistance = 99999;
    for (const r of MID_TA_REGIONS) {
        const d = calculateDistance(lat, lng, r.lat, r.lng);
        if (d < minDistance) {
            minDistance = d;
            taRegId = r.id;
        }
    }

    return { landRegId, taRegId };
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
    amWeatherLabel?: string;
    amWeatherEmoji?: string;
    amIsRainy?: boolean;
    pmWeatherLabel?: string;
    pmWeatherEmoji?: string;
    pmIsRainy?: boolean;
}

const DAY_NAMES = ['일', '월', '화', '수', '목', '금', '토'];
const SKY_MAP: Record<string, string> = { '1': '맑음', '3': '구름많음', '4': '흐림' };
const PTY_MAP: Record<string, string> = { '1': '비', '2': '비/눈', '3': '눈', '4': '소나기' };
const EMOJI_MAP: Record<string, string> = {
    '맑음': '☀️', '구름많음': '⛅', '흐림': '☁️',
    '비': '🌧️', '비/눈': '🌨️', '눈': '❄️', '소나기': '🌦️'
};

async function getMultiDayForecast(lat: number, lng: number, options: { forceCache?: boolean } = {}): Promise<DayForecast[]> {
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
        // During dispatch, we prioritize cache even if older (12h) to avoid live fetch delays
        const ttlHours = options.forceCache ? 12 : 6;
        const isCacheValid = cacheHit && (now.getTime() - new Date(cacheHit.updated_at).getTime() < ttlHours * 3600000);

        // --- Adapter for Frontend Cache Format ---
        // Frontend app API (/api/weather) stores object: { current: {...}, daily: [...], timeline: [...] }
        if (isCacheValid && cacheHit?.data) {
            if (Array.isArray(cacheHit.data)) {
                return cacheHit.data; // Native Cron Format
            } else if (cacheHit.data.daily && Array.isArray(cacheHit.data.daily)) {
                // Map Frontend Object to DayForecast[]
                const mapped: DayForecast[] = cacheHit.data.daily.map((d: any) => {
                    const dateStr = `${d.date.substring(0, 4)}-${d.date.substring(4, 6)}-${d.date.substring(6, 8)}`;
                    const dayName = DAY_NAMES[new Date(dateStr).getDay()];
                    let emoji = '☀️';
                    if (d.weatherCode === 'rainy' || d.weatherCode === 'snowy') emoji = '🌧️';
                    else if (d.weatherCode === 'cloudy') emoji = '☁️';
                    else if (d.weatherCode === 'partly_cloudy') emoji = '⛅';

                    return {
                        date: dateStr,
                        dayOfWeek: dayName,
                        weatherLabel: d.weatherCode,
                        weatherEmoji: emoji,
                        tempMin: d.min || 0,
                        tempMax: d.max || 0,
                        pop: d.pop || 0,
                        isRainy: d.weatherCode === 'rainy' || d.weatherCode === 'snowy'
                    };
                });
                return mapped;
            }
        }

        // 1.1 If forceCache is true but no valid cache, we skip live fetch to maintain speed
        if (options.forceCache) {
            console.warn(`[Weather] Cache miss for ${grid.x},${grid.y} in dispatch mode. Skipping live fetch.`);
            // Try to map even if stale
            if (cacheHit?.data) {
                if (Array.isArray(cacheHit.data)) return cacheHit.data;
                if (cacheHit.data.daily && Array.isArray(cacheHit.data.daily)) {
                    return cacheHit.data.daily.map((d: any) => {
                        const dateStr = `${d.date.substring(0, 4)}-${d.date.substring(4, 6)}-${d.date.substring(6, 8)}`;
                        const dayName = DAY_NAMES[new Date(dateStr).getDay()];
                        return {
                            date: dateStr, dayOfWeek: dayName, weatherLabel: d.weatherCode,
                            weatherEmoji: d.weatherCode === 'rainy' ? '🌧️' : '☀️',
                            tempMin: d.min || 0, tempMax: d.max || 0, pop: d.pop || 0,
                            isRainy: d.weatherCode === 'rainy' || d.weatherCode === 'snowy'
                        };
                    });
                }
            }
            return [mockForecast(kst.toISOString().split('T')[0])];
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
        const timeoutId = setTimeout(() => controller.abort(), 6000); // Tight 6s timeout for batch performance

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
            let skyAm = '1', ptyAm = '0';
            let skyPm = '1', ptyPm = '0';

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

                if (t >= '0600' && t <= '0900') {
                    if (cat === 'SKY') skyAm = val;
                    if (cat === 'PTY' && val !== '0') ptyAm = val;
                }
                if (t >= '1200' && t <= '1500') {
                    if (cat === 'SKY') skyPm = val;
                    if (cat === 'PTY' && val !== '0') ptyPm = val;
                    skyAfternoon = val;
                }
                if (cat === 'PTY' && val !== '0') ptyAny = val;
            }
            if (tmn === 999) tmn = 15;
            if (tmx === -999) tmx = 25;

            const weatherLabel = ptyAny !== '0' ? (PTY_MAP[ptyAny] || '비') : (SKY_MAP[skyAfternoon] || '맑음');
            const amLabel = ptyAm !== '0' ? (PTY_MAP[ptyAm] || '비') : (SKY_MAP[skyAm] || '맑음');
            const pmLabel = ptyPm !== '0' ? (PTY_MAP[ptyPm] || '비') : (SKY_MAP[skyPm] || '맑음');

            return {
                date: dateStr,
                dayOfWeek: DAY_NAMES[new Date(dateStr).getDay()],
                weatherLabel,
                weatherEmoji: EMOJI_MAP[weatherLabel] || '☀️',
                tempMin: Math.round(tmn),
                tempMax: Math.round(tmx),
                pop: maxPop,
                isRainy: ptyAny !== '0' || maxPop > 60,
                amWeatherLabel: amLabel,
                amWeatherEmoji: EMOJI_MAP[amLabel] || '☀️',
                amIsRainy: ptyAm !== '0',
                pmWeatherLabel: pmLabel,
                pmWeatherEmoji: EMOJI_MAP[pmLabel] || '☀️',
                pmIsRainy: ptyPm !== '0',
            };
        });

        // 2.5. Fetch Mid-Term Forecast for days +3 to +7
        try {
            const midTmFc = hour < 6
                ? new Date(kst.getTime() - 86400000).toISOString().split('T')[0].replace(/-/g, '') + '1800'
                : (hour >= 18 ? baseDate + '1800' : baseDate + '0600');

            // Dynamic mid-term regions based on user's exact coordinates!
            const { landRegId, taRegId } = getMidTermRegionCodes(lat, lng);
            const urlLand = `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${KMA_KEY}&pageNo=1&numOfRows=10&dataType=JSON&regId=${landRegId}&tmFc=${midTmFc}`;
            const urlTa = `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa?serviceKey=${KMA_KEY}&pageNo=1&numOfRows=10&dataType=JSON&regId=${taRegId}&tmFc=${midTmFc}`;

            const midController = new AbortController();
            const midTimeoutId = setTimeout(() => midController.abort(), 4000);

            const [resLand, resTa] = await Promise.all([
                fetch(urlLand, { signal: midController.signal }),
                fetch(urlTa, { signal: midController.signal })
            ]);
            clearTimeout(midTimeoutId);

            const dataLand = await resLand.json();
            const dataTa = await resTa.json();
            const land = dataLand?.response?.body?.items?.item?.[0];
            const ta = dataTa?.response?.body?.items?.item?.[0];

            if (land && ta) {
                const baseDateZero = new Date(kst);
                baseDateZero.setHours(0, 0, 0, 0);
                for (let i = 3; i <= 7; i++) {
                    const dateObj = new Date(baseDateZero);
                    dateObj.setDate(dateObj.getDate() + i);
                    const dateStr = dateObj.toISOString().split('T')[0];

                    // Skip if short-term API already provided it
                    if (dayForecasts.some(f => f.date === dateStr)) continue;

                    const amLabel = land['wf' + i + 'Am'] || land['wf' + i] || '맑음';
                    const pmLabel = land['wf' + i + 'Pm'] || land['wf' + i] || '맑음';
                    const pop = Math.max(Number(land['rnSt' + i + 'Am'] || land['rnSt' + i] || 0), Number(land['rnSt' + i + 'Pm'] || land['rnSt' + i] || 0));

                    const tempMin = ta['taMin' + i] || 10;
                    const tempMax = ta['taMax' + i] || 20;

                    const pmEmojiMatch = Object.entries(EMOJI_MAP).find(([key]) => pmLabel.includes(key));
                    const amEmojiMatch = Object.entries(EMOJI_MAP).find(([key]) => amLabel.includes(key));

                    dayForecasts.push({
                        date: dateStr,
                        dayOfWeek: DAY_NAMES[dateObj.getDay()],
                        weatherLabel: pmLabel,
                        weatherEmoji: pmEmojiMatch ? pmEmojiMatch[1] : '🌤',
                        tempMin, tempMax, pop,
                        isRainy: amLabel.includes('비') || pmLabel.includes('비') || pop >= 60,
                        amWeatherLabel: amLabel,
                        amWeatherEmoji: amEmojiMatch ? amEmojiMatch[1] : '🌤',
                        amIsRainy: amLabel.includes('비'),
                        pmWeatherLabel: pmLabel,
                        pmWeatherEmoji: pmEmojiMatch ? pmEmojiMatch[1] : '🌤',
                        pmIsRainy: pmLabel.includes('비')
                    });
                }
            }
        } catch (midErr) {
            console.warn('[Weather] Mid-term fetch skipped/failed:', midErr);
        }

        // Sort just in case
        dayForecasts.sort((a, b) => a.date.localeCompare(b.date));

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
        tempMin: 10, tempMax: 20, pop: 0, isRainy: false,
        amWeatherLabel: '맑음', amWeatherEmoji: '☀️', amIsRainy: false,
        pmWeatherLabel: '맑음', pmWeatherEmoji: '☀️', pmIsRainy: false,
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

                const results = await Promise.all(tokens.map(async (t: any) => {
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
                    .filter((r: any) => {
                        const isError = r.status === 400 || r.status === 404;
                        const errCode = r.resBody?.error?.details?.[0]?.errorCode;
                        const status = r.resBody?.error?.status;
                        return isError || status === 'UNREGISTERED' || status === 'NOT_FOUND' || errCode === 'UNREGISTERED';
                    })
                    .map((r: any) => r.token);

                if (invalidTokens.length > 0) {
                    console.log(`[CLEANUP] Pruning ${invalidTokens.length} stale tokens for user ${notif.user_id}`);
                    await supabase.from('push_tokens').delete().in('token', invalidTokens);
                }

                const successCount = results.filter((r: any) => r.status === 200).length;
                const finalStatus = successCount > 0 ? 'sent' : 'failed';
                const resultSummary = JSON.stringify(results.map((r: any) => ({ status: r.status, err: r.resBody?.error?.message })));

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
serve(async (req: any) => {
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

        const yesterdayDate = new Date(kst); yesterdayDate.setDate(yesterdayDate.getDate() - 1);
        const yesterday = yesterdayDate.toISOString().split('T')[0];

        const { data: schedules, error } = await supabase
            .from('user_schedules')
            .select('*')
            .eq('status', 'scheduled')
            .or(`check_in.in.(${today},${tomorrow},${d4}),and(check_out.eq.${yesterday},notification_record_reminder_sent.eq.false)`);

        if (error) throw error;
        console.log(`[Query] Found ${schedules?.length || 0} schedules`);

        if (!schedules || schedules.length === 0) {
            return new Response(JSON.stringify({ success: true, message: "No schedules found" }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // ==========================================
        // PREFETCH MODE (Cache Populating)
        // ==========================================
        if (mode === 'prefetch') {
            // Extract unique GRIDS (nx, ny) instead of just lat/lng
            // This is significantly more scalable as multiple locations share the same grid
            const uniqueGrids = new Map<string, { lat: number, lng: number }>();

            schedules.forEach((s: any) => {
                const lat = s.campground_lat || 36.6269;
                const lng = s.campground_lng || 126.7647;
                const grid = dfs_xy_conv("toXY", lat, lng);
                const key = `${grid.x},${grid.y}`;
                if (!uniqueGrids.has(key)) {
                    uniqueGrids.set(key, { lat, lng });
                }
            });

            console.log(`[Prefetch] Fetching APIs for ${uniqueGrids.size} unique grids...`);

            // Prefetch nearby events (Nationwide cache in one go)
            await getNearbyEvents(36.6269, 126.7647, 30);

            // Prefetch weather for detected grids
            const gridArray = Array.from(uniqueGrids.values());
            const chunkSize = 3;
            for (let i = 0; i < gridArray.length; i += chunkSize) {
                const chunk = gridArray.slice(i, i + chunkSize);
                await Promise.all(chunk.map(c =>
                    getMultiDayForecast(c.lat, c.lng).catch(err => console.error(`[Prefetch Error] Grid failure:`, err))
                ));
            }

            console.log("[Prefetch] Done.");
            return new Response(JSON.stringify({ success: true, mode: 'prefetch', grids: uniqueGrids.size }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

        // ==========================================
        // DISPATCH MODE (Queueing Notifications)
        // ==========================================
        const notifications: any[] = [];
        const updateIds: Record<string, string[]> = { d0: [], d1: [], d4: [], record_reminder: [] };

        // 어제 퇴실한 일정 중 이미 작성된 기록이 있는지 일괄 확인
        const yesterdaySchedules = schedules.filter((s: any) => s.check_out === yesterday && !s.notification_record_reminder_sent);
        const writtenIdsSet = new Set<string>();
        if (yesterdaySchedules.length > 0) {
            const yesterdayIds = yesterdaySchedules.map((s: any) => s.id);
            const { data: writtenRecords } = await supabase
                .from('camping_records')
                .select('schedule_id')
                .in('schedule_id', yesterdayIds);
            
            if (writtenRecords) {
                writtenRecords.forEach((r: any) => {
                    if (r.schedule_id) writtenIdsSet.add(r.schedule_id);
                });
            }
        }

        for (const s of schedules) {
            if (s.status === 'cancelled') continue; // [FIX] 2차 방어 가드: 취소된 스케줄은 즉시 건너뜀
            const lat = s.campground_lat || 36.6269;
            const lng = s.campground_lng || 126.7647;
            const displayName = s.source === 'raonai' ? `라온아이 캠핑장 (${s.campground_name})` : (s.campground_name || '캠핑장');

            // Gets from cache mostly, fast. (forceCache: true ensures we don't block on KMA during dispatch)
            const forecasts = await getMultiDayForecast(lat, lng, { forceCache: true });

            // Format multi-day weather (up to 3 days of the trip)
            const start = new Date(s.check_in);
            const end = s.check_out ? new Date(s.check_out) : new Date(start.getTime() + 86400000);

            let weatherLines = [];
            let isRainyAny = false;
            let tempMinOverall = 999;
            let tempMaxOverall = -999;

            let curr = new Date(start);
            const checkOutStr = end.toISOString().split('T')[0];

            for (let i = 0; i < 4; i++) { // Max 4 days to prevent runway loops
                const dStr = curr.toISOString().split('T')[0];
                const isCheckInDay = (dStr === s.check_in);
                const isCheckOutDay = (dStr === checkOutStr);

                const fRaw = forecasts.find(x => x.date === dStr) || mockForecast(dStr);
                const dayName = fRaw.dayOfWeek || DAY_NAMES[curr.getDay()];

                let emoji = fRaw.weatherEmoji;
                let dayLabel = dayName;

                if (isCheckInDay) {
                    dayLabel = `${dayName} 오후`;
                    emoji = fRaw.pmWeatherEmoji || fRaw.weatherEmoji;
                } else if (isCheckOutDay) {
                    dayLabel = `${dayName} 오전`;
                    emoji = fRaw.amWeatherEmoji || fRaw.weatherEmoji;
                }

                weatherLines.push(`${dayLabel}: ${emoji} ${fRaw.tempMin}°/${fRaw.tempMax}°`);

                if (fRaw.isRainy) isRainyAny = true;
                if (fRaw.tempMin < tempMinOverall) tempMinOverall = fRaw.tempMin;
                if (fRaw.tempMax > tempMaxOverall) tempMaxOverall = fRaw.tempMax;

                if (isCheckOutDay || i >= 3) {
                    break;
                }

                curr.setDate(curr.getDate() + 1);
            }
            const weatherLine = weatherLines.join(' | ');

            // Virtual primary forecast representing the trip overall conditions
            const primaryForecast = forecasts.find(x => x.date === s.check_in) || mockForecast(s.check_in);
            primaryForecast.isRainy = isRainyAny;
            primaryForecast.tempMin = tempMinOverall;
            primaryForecast.tempMax = tempMaxOverall;

            // Post-Check-Out: Record Reminder (1분 기록 독려)
            if (s.check_out === yesterday && !s.notification_record_reminder_sent) {
                if (!writtenIdsSet.has(s.id)) {
                    notifications.push({
                        user_id: s.user_id,
                        category: 'reservation',
                        event_type: 'camping_record_reminder',
                        title: `⛺ 지난 캠핑은 어떠셨나요? 10초 만에 핀 꽂기`,
                        body: `${displayName}에서의 추억을 10초 만족도 이모지와 함께 핀으로 꽂아보세요! ✨`,
                        data: { link: `/myspace` },
                        status: 'queued'
                    });
                }
                updateIds.record_reminder.push(s.id);
            }
            // D-0: Today is the day!
            else if (s.check_in === today && !s.notification_d0_sent) {
                const events = await getNearbyEvents(lat, lng, 30, s.check_in, s.check_out);
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
                    body: `📍 ${displayName}\n${weatherLine}\n\n${eventText}\n설레는 발걸음, 안전하게 다녀오세요!`,
                    data: { 
                        link: `/myspace/schedule/${s.id}`,
                        hero_image: "https://raon-i.co.kr/images/reminder_hero.png"
                    },
                    status: 'queued'
                });
                updateIds.d0.push(s.id);
            }
            // D-1: Meal Recommendations
            else if (s.check_in === tomorrow && !s.notification_d1_sent) {
                const meals = await getScoredMenuRecommendations(s.user_id, primaryForecast, s.member_count || 2);
                const menuText = meals.length > 0
                    ? meals.map(m => `🍽️ ${m.title}`).join(', ')
                    : "캠핑장에서 즐기기 좋은 맛있는 요리";

                notifications.push({
                    user_id: s.user_id,
                    category: 'reservation',
                    event_type: 'upcoming_stay_d1',
                    title: `🍳 내일 뭐 먹을지 고민되시나요?`,
                    body: `📍 ${displayName}\n${weatherLine}\n\n날씨에 딱 맞는 메뉴를 골라봤어요!\n추천 메뉴: ${menuText}\n\n레시피가 궁금하다면 확인해보세요!`,
                    data: { 
                        link: `/recipe`, 
                        hero_image: "https://raon-i.co.kr/images/reminder_hero.png"
                    },
                    status: 'queued'
                });
                updateIds.d1.push(s.id);
            }
            // D-4: Gear Check
            else if (s.check_in === d4 && !s.notification_d4_sent) {
                const gears = await getScoredGearRecommendations(primaryForecast, 2);
                let tip = '평범한 날씨네요! 가볍게 떠나보세요.';

                if (gears.length > 0) {
                    tip = gears.map(g => `💡 ${g.title}: ${g.description}`).join('\n\n');
                } else {
                    if (primaryForecast.isRainy) tip = '비 소식이 있어요 ☔ 우비와 타프 꼭 챙기세요!';
                    else if (primaryForecast.tempMin < 10) tip = '밤에는 쌀쌀해요 🧣 따뜻한 침낭과 핫팩 잊지 마세요.';
                    else if (primaryForecast.tempMax >= 28) tip = '한낮 기온이 30도 내외로 무더워요 ☀️ 타프와 시원한 음료를 준비하세요.';
                }

                notifications.push({
                    user_id: s.user_id,
                    category: 'reservation',
                    event_type: 'upcoming_stay_d4', // Fixed type
                    title: `🎒 캠핑이 4일 남았어요!`,
                    body: `📍 ${displayName}\n${weatherLine}\n\n[맞춤 준비물]\n${tip}`,
                    data: { 
                        link: `/myspace/schedule/${s.id}?tab=checklist`,
                        hero_image: "https://raon-i.co.kr/images/reminder_hero.png"
                    },
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
        if (updateIds.record_reminder.length > 0) await supabase.from('user_schedules').update({ notification_record_reminder_sent: true }).in('id', updateIds.record_reminder);

        return new Response(JSON.stringify({ success: true, mode: 'dispatch', count: notifications.length }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

    } catch (err: any) {
        console.error("Critical Error:", err);
        return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: corsHeaders });
    }
});
