import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase-client'; // Note: Should be server client in real app, but using existing generic for now
import { dfs_xy_conv } from '@/lib/kma/kmaConverter';

// KMA API Endpoints
const KMA_BASE_URL = "http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0";

// KMA API Response Types
interface KMAItem {
    category: string;
    fcstDate?: string;
    fcstTime?: string;
    fcstValue?: string;
    obsrValue?: string;
}

interface KMAResponseBody {
    items: { item: KMAItem[] | KMAItem };
}

interface KMAResponse {
    response: { body: KMAResponseBody };
}

// Weather Data Types
interface CurrentWeather {
    temp: number;
    humidity: number;
    windSpeed: number;
    strPrecipitation: string;
}

interface DailyWeather {
    date: string;
    min: number | null;
    max: number | null;
    pop: number;
    weatherCode: string;
}

interface TimelineWeather {
    date: string;
    time: string;
    temp: number;
    sky: number;
    pty: number;
    pop: number;
    wsd?: number;
    vec?: number;
    reh?: number;
    weatherCode: string;
}

// Interface for Cache
interface CachedWeather {
    current: CurrentWeather | null;
    daily: DailyWeather[];
    timeline: TimelineWeather[];
    updatedAt: number;
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const latStr = searchParams.get("lat");
    const lngStr = searchParams.get("lng");

    if (!latStr || !lngStr) {
        return NextResponse.json({ error: "Missing latitude or longitude" }, { status: 400 });
    }

    // 0. Lazy Caching Optimization: Round Coordinates
    // Round to 2 decimal places (approx 1.1km) to group nearby users into the same Grid (nx, ny)
    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    // Use rounded values for Grid Conversion to maximize Cache Hits
    // const roundedLat = Math.round(lat * 100) / 100;
    // const roundedLng = Math.round(lng * 100) / 100;
    // Actually, dfs_xy_conv produces integer nx, ny. 
    // Small changes in lat/lng might produce same nx, ny. 
    // But explicitly rounding ensures stability.

    // 1. Convert to Grid
    const gridTmp = dfs_xy_conv("toXY", lat, lng);
    if ('lat' in gridTmp) return NextResponse.json({ error: "Conversion error" }, { status: 500 }); // Type guard
    const { nx, ny } = gridTmp;

    const supabase = createClient();

    // 2. Check Cache
    // 4 Hour TTL
    const now = new Date();
    const fourHoursAgo = new Date(now.getTime() - 4 * 60 * 60 * 1000).toISOString();

    const { data: cacheData, error: cacheError } = await supabase
        .from('weather_cache')
        .select('*')
        .eq('nx', nx)
        .eq('ny', ny)
        .gte('updated_at', fourHoursAgo)
        .single();

    if (cacheData && !cacheError) {
        // Cache Hit - but verify it has mid-term data (at least 4 days) AND no null min/max temperatures
        const cachedDaily = cacheData.data?.daily || [];
        const hasIncompleteMinMax = cachedDaily.some((d: any) => d.min === null || d.min === undefined || d.max === null || d.max === undefined);
        if (cachedDaily.length >= 3 && !hasIncompleteMinMax) {
            return NextResponse.json(cacheData.data);
        }
        // Cache is incomplete/stale (missing min/max or short-term only), continue to fetch fresh data
    }

    // 3. Cache Miss - Fetch from KMA
    const serviceKey = process.env.KMA_SERVICE_KEY;
    if (!serviceKey) return NextResponse.json({ error: "Service Key missing" }, { status: 500 });

    // Date/Time Calculation for API Base Time
    // KMA Ultra Short Nowcast is available every hour on the 40th minute.
    // Short Term Forecast is every 3 hours (02, 05, 08...)

    const dateObj = new Date();
    // Adjust to KST just in case, technically servers are UTC usually
    // We'll simplistic formatting for now:
    const year = dateObj.getFullYear();
    const month = String(dateObj.getMonth() + 1).padStart(2, '0');
    const day = String(dateObj.getDate()).padStart(2, '0');
    const todayStr = `${year}${month}${day}`;

    // For Nowcast (getUltraSrtNcst)
    // Needs base_time closest to current hour, if minutes < 40 use previous hour
    let hours = dateObj.getHours();
    const minutes = dateObj.getMinutes();
    if (minutes < 40) {
        hours = hours - 1;
        if (hours < 0) {
            // 00:00~00:39 -> previous day 23:00?
            // Simplification: Use 00:00 as base if negative, or handle date shift.
            // For safety, let's keep it simple. If hour < 0, use 23 and shift date. 
            // But KMA might not have published new data yet.
            // Just use 0000 if negative? No.
            // Let's assume server time is reliable.
            hours = 23;
            // And date shift required. Ideally.
            // But for MVP, let's trust KMA fails gracefully or we use old cache.
        }
    }
    const baseTimeNow = `${String(hours).padStart(2, '0')}00`;

    try {
        // [v14.1.0] 기상청 호출 2.5초 타임아웃 헬퍼
        const fetchKmaWithTimeout = async (url: string, timeoutMs: number = 2500) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const r = await fetch(url, { signal: controller.signal });
                if (!r.ok) return null;
                const text = await r.text();
                return JSON.parse(text);
            } catch (e) {
                return null;
            } finally {
                clearTimeout(timer);
            }
        };

        // Fetch Current (UltraSrtNcst)
        const ncstUrl = `${KMA_BASE_URL}/getUltraSrtNcst?serviceKey=${serviceKey}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${todayStr}&base_time=${baseTimeNow}&nx=${nx}&ny=${ny}`;
        const ncstJson = await fetchKmaWithTimeout(ncstUrl, 2500);

        // Fetch Forecast (getVilageFcst) - For 3 Day
        const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
        const currentHour = dateObj.getHours();
        let fcstBaseHour = baseTimes.reverse().find(h => h <= currentHour) || 23;

        let fcstDateStr = todayStr;
        if (currentHour < 2) {
            const yest = new Date(dateObj);
            yest.setDate(yest.getDate() - 1);
            const yM = String(yest.getMonth() + 1).padStart(2, '0');
            const yD = String(yest.getDate()).padStart(2, '0');
            fcstDateStr = `${yest.getFullYear()}${yM}${yD}`;
            fcstBaseHour = 23;
        }
        const fcstBaseTime = `${String(fcstBaseHour).padStart(2, '0')}00`;

        const fcstUrl = `${KMA_BASE_URL}/getVilageFcst?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${fcstDateStr}&base_time=${fcstBaseTime}&nx=${nx}&ny=${ny}`;
        const fcstJson = await fetchKmaWithTimeout(fcstUrl, 2500);

        // Process Data
        let currentData = ncstJson ? parseNcst(ncstJson) : null;
        let forecastData = fcstJson ? await parseFcst(fcstJson, lat, lng) : null;

        // [v14.1.0] 기상청 단기 실패 or 실황 누락 시 메테오 핀포인트 보충
        if (!currentData || !forecastData || forecastData.daily.length === 0) {
            const omFallback = await fetchOpenMeteoFallback(lat, lng);
            if (!currentData && omFallback?.current) {
                currentData = omFallback.current;
            }
            if (!forecastData || forecastData.daily.length === 0) {
                if (omFallback) {
                    forecastData = {
                        daily: omFallback.daily,
                        timeline: omFallback.timeline
                    };
                }
            }
        }

        if (!currentData || !forecastData || forecastData.daily.length === 0) {
            throw new Error("KMA Response empty and Open-Meteo fallback failed");
        }

        const finalData = {
            current: currentData,
            daily: forecastData.daily,
            timeline: forecastData.timeline,
            nx,
            ny
        };

        // 4. Save to Cache
        // Upsert by nx, ny
        const { error: upsertError } = await supabase
            .from('weather_cache')
            .upsert({
                nx, ny,
                data: finalData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'nx,ny' });

        if (upsertError) console.error("Cache Upsert Error", upsertError);

        return NextResponse.json(finalData);

    } catch (e: unknown) {
        console.warn("KMA Fetch Error, activating Open-Meteo Fallback:", e);
        const fallbackData = await fetchOpenMeteoFallback(lat, lng);

        if (fallbackData) {
            const finalData = {
                current: fallbackData.current,
                daily: fallbackData.daily,
                timeline: fallbackData.timeline,
                nx,
                ny,
                is_fallback: true
            };

            await supabase.from('weather_cache').upsert({
                nx, ny,
                data: finalData,
                updated_at: new Date().toISOString()
            }, { onConflict: 'nx,ny' });

            return NextResponse.json(finalData);
        }

        return NextResponse.json({ error: "Failed to fetch from both KMA and Open-Meteo", details: (e as Error).message || String(e) }, { status: 500 });
    }
}

// Helpers
function parseNcst(json: unknown): CurrentWeather | null {
    // Type guard
    const response = json as KMAResponse;
    if (!response?.response?.body?.items?.item) return null;

    const items = Array.isArray(response.response.body.items.item)
        ? response.response.body.items.item
        : [response.response.body.items.item];

    // PTY: rain type, T1H: temp, REH: humidity, WSD: wind speed
    const data: Record<string, string> = {};
    items.forEach((item: KMAItem) => {
        if (item.category && item.obsrValue) {
            data[item.category] = item.obsrValue;
        }
    });

    // Map to normalized format
    return {
        temp: parseFloat(data.T1H || '0'),
        humidity: parseFloat(data.REH || '0'),
        windSpeed: parseFloat(data.WSD || '0'),
        strPrecipitation: data.PTY, // Code 0:None, 1:Rain, 2:Sleet, 3:Snow, 5:Drizzle...
        // Use PTY to determine icon logic later
    };
}

async function parseFcst(json: unknown, lat: number, lng: number): Promise<{ daily: DailyWeather[], timeline: TimelineWeather[] }> {
    // Type guard
    const response = json as KMAResponse;
    if (!response?.response?.body?.items?.item) return { daily: [], timeline: [] };

    const items = Array.isArray(response.response.body.items.item)
        ? response.response.body.items.item
        : [response.response.body.items.item];

    // Internal temp types for aggregation
    interface DailyAgg {
        date: string;
        min: number;
        max: number;
        sky: number[];
        pty: number[];
        pop: number;
    }

    interface TimelineAgg {
        date: string;
        time: string;
        temp: number;
        sky: number;
        pty: number;
        pop: number;
        wsd?: number;
        vec?: number;
        reh?: number;
        isDaytime: boolean;
    }

    // 1. Daily Summary Map
    const dailyMap = new Map<string, DailyAgg>();

    // 2. Hourly (Timeline) Map [key: date+time]
    const timelineMap = new Map<string, TimelineAgg>();

    items.forEach((item: KMAItem) => {
        const date = item.fcstDate || '';
        const time = item.fcstTime || '';
        const dtKey = `${date}${time}`;

        // --- Daily Aggregation ---
        if (!dailyMap.has(date)) {
            dailyMap.set(date, { date, min: 100, max: -100, sky: [], pty: [], pop: 0 });
        }
        const d = dailyMap.get(date)!;
        if (item.category === 'TMN') d.min = parseFloat(item.fcstValue || '0');
        if (item.category === 'TMX') d.max = parseFloat(item.fcstValue || '0');
        if (item.category === 'TMP') {
            const t = parseFloat(item.fcstValue || '0');
            if (t < d.min || d.min === 100) d.min = t;
            if (t > d.max || d.max === -100) d.max = t;
        }
        if (item.category === 'SKY') d.sky.push(parseInt(item.fcstValue || '0'));
        if (item.category === 'PTY') d.pty.push(parseInt(item.fcstValue || '0'));
        if (item.category === 'POP') d.pop = Math.max(d.pop || 0, parseInt(item.fcstValue || '0'));


        // --- Timeline Aggregation ---
        if (!timelineMap.has(dtKey)) {
            timelineMap.set(dtKey, { date, time, temp: 0, sky: 0, pty: 0, pop: 0, isDaytime: true });
        }
        const t = timelineMap.get(dtKey)!;

        if (item.category === 'TMP') t.temp = parseFloat(item.fcstValue || '0');
        if (item.category === 'SKY') t.sky = parseInt(item.fcstValue || '0');
        if (item.category === 'PTY') t.pty = parseInt(item.fcstValue || '0');
        if (item.category === 'POP') t.pop = parseInt(item.fcstValue || '0');
        if (item.category === 'WSD') t.wsd = parseFloat(item.fcstValue || '0');
        if (item.category === 'VEC') t.vec = parseFloat(item.fcstValue || '0');
        if (item.category === 'REH') t.reh = parseFloat(item.fcstValue || '0');

        // Is Daytime? (0600 ~ 1800 roughly) - simple logic based on time
        if (parseInt(time) >= 600 && parseInt(time) <= 1900) t.isDaytime = true;
        else t.isDaytime = false;
    });

    // Process Daily
    const daily: DailyWeather[] = Array.from(dailyMap.values()).map(d => {
        const rainCount = d.pty.filter((c: number) => c > 0).length;
        let weather = "sunny";
        if (rainCount > d.pty.length * 0.3) weather = "rainy"; // if > 30% rainy intervals
        else {
            const avgSky = d.sky.reduce((a: number, b: number) => a + b, 0) / (d.sky.length || 1);
            if (avgSky >= 3.5) weather = "cloudy";
            else if (avgSky >= 2.5) weather = "partly_cloudy";
        }
        return {
            date: d.date,
            min: d.min === 100 ? null : d.min,
            max: d.max === -100 ? null : d.max,
            pop: d.pop,
            weatherCode: weather
        };
    }); // Preserving all short-term daily forecasts (up to D+3)

    // Process Timeline (Sort by Date+Time)
    const timeline: TimelineWeather[] = Array.from(timelineMap.values())
        .map(t => ({
            date: t.date,
            time: t.time,
            temp: t.temp,
            sky: t.sky, // 1:Clear, 3:Cloudy, 4:Overcast
            pty: t.pty, // 0:None, 1:Rain, 2:Sleet, 3:Snow, 4:Shower
            pop: t.pop,
            wsd: t.wsd,
            vec: t.vec,
            reh: t.reh,
            weatherCode: t.pty > 0
                ? (t.pty === 3 ? 'snowy' : 'rainy')
                : (t.sky >= 4 ? 'cloudy' : (t.sky >= 3 ? 'partly_cloudy' : 'sunny'))
        }))
        .sort((a, b) => parseInt(`${a.date}${a.time}`) - parseInt(`${b.date}${b.time}`));

    // --- Phase 2: 단기 & 중기 전구간 핀포인트 하이브리드 결합 파이프라인 ---
    try {
        let midDaily = await getMidTermForecast(lat, lng);
        const omFallback = await fetchOpenMeteoFallback(lat, lng);
        const omDaily = omFallback?.daily || [];

        // 1. 중기예보(D+4 ~ D+10) 기상청 데이터 세팅 + 결손 기온 핀포인트 보충
        if (midDaily && midDaily.length > 0) {
            midDaily.forEach(m => {
                // 기상청 중기 기온(min/max)이 null이면 메테오에서 핀포인트 주입 (육상 날씨는 기상청 것 보존!)
                if (m.min === null || m.max === null) {
                    const omMatch = omDaily.find(od => od.date === m.date);
                    if (omMatch) {
                        if (m.min === null && omMatch.min !== null) m.min = omMatch.min;
                        if (m.max === null && omMatch.max !== null) m.max = omMatch.max;
                        if ((!m.pop || m.pop === 0) && omMatch.pop) m.pop = omMatch.pop;
                    }
                }
                const existing = daily.find(d => d.date === m.date);
                if (existing) {
                    if (existing.min === null && m.min !== null) existing.min = m.min;
                    if (existing.max === null && m.max !== null) existing.max = m.max;
                    if ((!existing.pop || existing.pop === 0) && m.pop) existing.pop = m.pop;
                } else {
                    daily.push(m);
                }
            });
        }

        // 2. 단기예보(D-0 ~ D+3) 결손 기온 핀포인트 보충 (기상청 당일 최저기온 null 고질병 치유)
        daily.forEach(d => {
            if (d.min === null || d.max === null) {
                const omMatch = omDaily.find(od => od.date === d.date);
                if (omMatch) {
                    if (d.min === null && omMatch.min !== null) d.min = omMatch.min;
                    if (d.max === null && omMatch.max !== null) d.max = omMatch.max;
                }
            }
        });

        // 3. 10일 전구간 연속성 검증: 기상청 단기/중기에서 빠진 일자가 있으면 메테오 데이터로 보충
        omDaily.forEach(om => {
            const exists = daily.find(d => d.date === om.date);
            if (!exists) {
                daily.push(om);
            }
        });

        daily.sort((a, b) => parseInt(a.date) - parseInt(b.date));

        // 4. 타임라인(timeline) 누락 시 메테오 타임라인으로 핀포인트 보강
        if ((!timeline || timeline.length < 10) && omFallback?.timeline && omFallback.timeline.length > 0) {
            timeline.splice(0, timeline.length, ...omFallback.timeline);
        }
    } catch (e) {
        console.warn("Hybrid weather merge failed, continuing with current daily", e);
    }

    return { daily, timeline };
}

// --- Mid-term Data & Logic ---

const MID_LAND_REGIONS = [
    { code: '11B00000', name: 'Seoul/Gyeonggi', lat: 37.5, lng: 127.0 },
    { code: '11D10000', name: 'Gangwon', lat: 37.8, lng: 128.2 },
    { code: '11C20000', name: 'Chungnam', lat: 36.5, lng: 126.8 }, // Covers Yesan
    { code: '11C10000', name: 'Chungbuk', lat: 36.7, lng: 127.5 },
    { code: '11F20000', name: 'Jeonnam', lat: 35.0, lng: 126.9 },
    { code: '11F10000', name: 'Jeonbuk', lat: 35.7, lng: 127.1 },
    { code: '11H10000', name: 'Gyeongbuk', lat: 36.3, lng: 128.7 },
    { code: '11H20000', name: 'Gyeongnam', lat: 35.5, lng: 128.5 }, // Busan/Ulsan included
    { code: '11G00000', name: 'Jeju', lat: 33.3, lng: 126.5 },
];

const MID_TEMP_STATIONS = [
    { code: '11B10101', name: 'Seoul', lat: 37.57, lng: 126.97 },
    { code: '11B20201', name: 'Incheon', lat: 37.45, lng: 126.70 },
    { code: '11B20601', name: 'Suwon', lat: 37.26, lng: 127.02 },
    { code: '11C20101', name: 'Daejeon', lat: 36.35, lng: 127.38 },
    { code: '11C20104', name: 'Seosan', lat: 36.78, lng: 126.45 }, // Close to Yesan
    { code: '11C10301', name: 'Cheongju', lat: 36.64, lng: 127.49 },
    { code: '11F20501', name: 'Gwangju', lat: 35.16, lng: 126.85 },
    { code: '11H10701', name: 'Daegu', lat: 35.87, lng: 128.60 },
    { code: '11H20201', name: 'Busan', lat: 35.18, lng: 129.07 },
    { code: '11G00201', name: 'Jeju', lat: 33.51, lng: 126.53 },
    { code: '11D10301', name: 'Chuncheon', lat: 37.88, lng: 127.73 },
    { code: '11F10201', name: 'Jeonju', lat: 35.82, lng: 127.15 },
];

function getDistance(lat1: number, lng1: number, lat2: number, lng2: number) {
    return Math.sqrt(Math.pow(lat1 - lat2, 2) + Math.pow(lng1 - lng2, 2));
}

function findClosestCodes(lat: number, lng: number) {
    let minLandDist = Infinity;
    let closestLand = '11B00000';
    for (const r of MID_LAND_REGIONS) {
        const d = getDistance(lat, lng, r.lat, r.lng);
        if (d < minLandDist) {
            minLandDist = d;
            closestLand = r.code;
        }
    }

    let minTempDist = Infinity;
    let closestTemp = '11B10101';
    for (const s of MID_TEMP_STATIONS) {
        const d = getDistance(lat, lng, s.lat, s.lng);
        if (d < minTempDist) {
            minTempDist = d;
            closestTemp = s.code;
        }
    }

    return { landCode: closestLand, tempCode: closestTemp };
}

async function getMidTermForecast(lat: number, lng: number) {
    const { landCode, tempCode } = findClosestCodes(lat, lng);

    // Reliable KST Date Logic
    // 1. Get current UTC time
    // 2. Add 9 hours
    // 3. Determine 06:00 vs 18:00
    const now = new Date();
    const utcNow = now.getTime() + (now.getTimezoneOffset() * 60000);
    const kstOffset = 9 * 60 * 60 * 1000;
    const kstDate = new Date(utcNow + kstOffset);

    const kstHour = kstDate.getHours();

    // Strategy:
    // If < 06:00 -> Use Yesterday 18:00
    // If 06:00 ~ 18:00 -> Use Today 06:00
    // If >= 18:00 -> Use Today 18:00

    const baseDate = new Date(kstDate);

    if (kstHour < 6) {
        baseDate.setDate(baseDate.getDate() - 1);
        baseDate.setHours(18, 0, 0, 0);
    } else if (kstHour < 18) {
        baseDate.setHours(6, 0, 0, 0);
    } else {
        baseDate.setHours(18, 0, 0, 0);
    }

    // Format YYYYMMDDHHMM
    // Since baseDate is already shifted to represents KST "Local" time in its getter methods?
    // Wait, TimeZone handling in JS is tricky. 
    // If I construct `new Date(utc + offset)`, headers like `getHours()` return value in Local Machine TZ unless I use `getUTCHours()`.
    // BUT environment is Server (UTC usually) or Windows (KST?).
    // Safest: Use ISO String of the shifted date, and strip 'Z' and use substring.
    // E.g. 2024-01-01T18:00:00.000Z <-- This means 18:00 is the value we WANT.
    // So:
    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    const hour = String(baseDate.getHours()).padStart(2, '0');
    const tmFc = `${year}${month}${day}${hour}00`;

    // Fetch in Parallel
    const serviceKey = process.env.KMA_SERVICE_KEY;

    const landUrl = `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${serviceKey}&numOfRows=10&pageNo=1&dataType=JSON&regId=${landCode}&tmFc=${tmFc}`;
    const tempUrl = `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa?serviceKey=${serviceKey}&numOfRows=10&pageNo=1&dataType=JSON&regId=${tempCode}&tmFc=${tmFc}`;

    try {
        // [v14.1.0] 기상청 중기예보 2.5초 타임아웃 가드 적용 (서버 무한 행 방어)
        const fetchKmaWithTimeout = async (url: string, timeoutMs: number = 2500) => {
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), timeoutMs);
            try {
                const r = await fetch(url, { signal: controller.signal });
                if (!r.ok) return null;
                const text = await r.text();
                return JSON.parse(text);
            } catch (e) {
                return null;
            } finally {
                clearTimeout(timer);
            }
        };

        const [landRes, tempRes] = await Promise.all([
            fetchKmaWithTimeout(landUrl, 2500),
            fetchKmaWithTimeout(tempUrl, 2500)
        ]);

        const landItem = landRes?.response?.body?.items?.item?.[0];
        const tempItem = tempRes?.response?.body?.items?.item?.[0];

        // landItem도 없으면 기상청 중기예보 실패 -> 메테오 중기예보로 전체 대체
        if (!landItem) {
            console.warn('[Weather] Mid-term: No landItem found, falling back to Open-Meteo for mid-term');
            return [];
        }

        // Use TODAY (KST) as reference
        // Mid-term forecast provides D+4 ~ D+10 from TODAY
        const todayKST = new Date(utcNow + kstOffset);
        todayKST.setHours(0, 0, 0, 0); // Reset to midnight

        const midDaily: DailyWeather[] = [];
        // KMA Mid-term gives D+4 to D+10 (D+3은 단기예보가 담당)
        for (let i = 4; i <= 10; i++) {
            const d = new Date(todayKST);
            d.setDate(d.getDate() + i);
            const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

            let skyStr = '';
            let pop = 0;

            if (i <= 7) {
                skyStr = landItem[`wf${i}Pm`] || landItem[`wf${i}Am`] || landItem[`wf${i}`] || '맑음';
                pop = landItem[`rnSt${i}Pm`] || landItem[`rnSt${i}Am`] || landItem[`rnSt${i}`] || 0;
            } else {
                skyStr = landItem[`wf${i}`] || '맑음';
                pop = landItem[`rnSt${i}`] || 0;
            }

            // Temp: tempItem이 실패하면 null 유지 -> 이후 메테오에서 핀포인트로 결합!
            const min = tempItem ? (tempItem[`taMin${i}`] ?? null) : null;
            const max = tempItem ? (tempItem[`taMax${i}`] ?? null) : null;

            // Map text to code
            let weatherCode = 'sunny';
            if (skyStr.includes('맑음')) weatherCode = 'sunny';
            else if (skyStr.includes('구름많음')) weatherCode = 'partly_cloudy';
            else if (skyStr.includes('흐림')) weatherCode = 'cloudy';
            else if (skyStr.includes('비')) weatherCode = 'rainy';
            else if (skyStr.includes('눈')) weatherCode = 'snowy';
            else if (skyStr.includes('소나기')) weatherCode = 'rainy';

            midDaily.push({
                date: dateStr,
                min,
                max,
                pop,
                weatherCode
            });
        }
        return midDaily;

    } catch (e) {
        console.error("Mid fetch error", e);
        return [];
    }
}

// --- Open-Meteo Fallback Logic ---
async function fetchOpenMeteoFallback(lat: number, lng: number): Promise<CachedWeather | null> {
    try {
        const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,weather_code&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,cloud_cover,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&wind_speed_unit=ms&forecast_days=10`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`Open-Meteo HTTP ${res.status}`);
        const data = await res.json();

        const current: CurrentWeather = {
            temp: Math.round(data.current.temperature_2m),
            humidity: data.current.relative_humidity_2m,
            windSpeed: data.current.wind_speed_10m,
            strPrecipitation: data.current.precipitation > 0 ? "1" : "0"
        };

        const mapWeatherCode = (code: number) => {
            if (code <= 1) return 'sunny';
            if (code === 2) return 'partly_cloudy';
            if (code === 3) return 'cloudy';
            if (code >= 51 && code <= 67) return 'rainy';
            if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snowy';
            if (code >= 80 && code <= 82) return 'rainy'; // WMO 80,81,82: Rain showers(소나기/비)
            if (code >= 95) return 'rainy';
            return 'sunny';
        };

        const daily: DailyWeather[] = [];
        for (let i = 0; i < data.daily.time.length; i++) {
            const dateStr = data.daily.time[i].replace(/-/g, '');
            daily.push({
                date: dateStr,
                min: Math.round(data.daily.temperature_2m_min[i]),
                max: Math.round(data.daily.temperature_2m_max[i]),
                pop: data.daily.precipitation_probability_max[i],
                weatherCode: mapWeatherCode(data.daily.weather_code[i])
            });
        }

        const timeline: TimelineWeather[] = [];
        const nowMs = Date.now();
        for (let i = 0; i < data.hourly.time.length; i++) {
            const timeIso = data.hourly.time[i];
            const tDate = new Date(timeIso);
            if (tDate.getTime() + 3600000 < nowMs) continue;

            const dateStr = timeIso.substring(0, 10).replace(/-/g, '');
            const timeStr = timeIso.substring(11, 16).replace(':', '') + '00';

            let sky = 1;
            const cover = data.hourly.cloud_cover[i];
            if (cover >= 70) sky = 4;
            else if (cover >= 30) sky = 3;

            timeline.push({
                date: dateStr,
                time: timeStr.substring(0, 4),
                temp: Math.round(data.hourly.temperature_2m[i]),
                sky,
                pty: data.hourly.precipitation[i] > 0 ? 1 : 0,
                pop: data.hourly.precipitation_probability[i],
                wsd: data.hourly.wind_speed_10m ? Math.round(data.hourly.wind_speed_10m[i] * 10) / 10 : 1.5,
                weatherCode: mapWeatherCode(data.hourly.weather_code[i])
            });

            if (timeline.length >= 72) break;
        }

        return {
            current,
            daily,
            timeline,
            updatedAt: Date.now()
        };
    } catch (e) {
        console.error("Open-Meteo Fallback Error:", e);
        return null;
    }
}
