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

    const lat = parseFloat(latStr);
    const lng = parseFloat(lngStr);

    // 1. Convert to Grid
    // Cast result to KMAGrid logic (toXY returns nx, ny)
    const gridTmp = dfs_xy_conv("toXY", lat, lng);
    if ('lat' in gridTmp) return NextResponse.json({ error: "Conversion error" }, { status: 500 }); // Type guard
    const { nx, ny } = gridTmp;

    const supabase = createClient();

    // 2. Check Cache
    // 1 Hour TTL
    const now = new Date();
    const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000).toISOString();

    const { data: cacheData, error: cacheError } = await supabase
        .from('weather_cache')
        .select('*')
        .eq('nx', nx)
        .eq('ny', ny)
        .gte('updated_at', oneHourAgo)
        .single();

    if (cacheData && !cacheError) {
        // Cache Hit - but verify it has mid-term data (at least 4 days)
        const cachedDaily = cacheData.data?.daily || [];
        if (cachedDaily.length >= 4) {
            return NextResponse.json(cacheData.data);
        }
        // Cache is stale (only has short-term), continue to fetch fresh data
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
    let minutes = dateObj.getMinutes();
    if (minutes < 40) {
        hours = hours - 1;
        if (hours < 0) {
            // Previous day logic complex, for MVP assume simple case (or just use 1 hour backup safely)
            // If < 00:40, go to 23:00 yesterday? KMA logic is strict.
            // Let's use a safe base time: Current Hour - 1 (always valid for NowCast?)
            // Actually NowCSast updates XX:40. So 10:30 -> use 09:00? No, 09:40 was released? 
            // Correct Logic: 
            // If min <= 40, base_time = (hour-1) : 00
            // If min > 40, base_time = hour : 00
        }
    }
    const baseTimeNow = `${String(hours).padStart(2, '0')}00`; // Just use hour, KMA accepts 00 usually for Ncst as base

    try {
        // Fetch Current (UltraSrtNcst)
        // Note: encoding key vs decoding key. Usually decoding key for manual query param composition in axios/fetch if not encoded?
        // Node fetch usually needs Encoded Key if simply appending string, OR Decoding Key if using URLSearchParams properly?
        // Public Data Portal is tricky. Let's try appending Decoding key directly to query params if ServiceKey param is manual.
        // Or simpler: Use standard fetch with URLSearchParams? 
        // Warning: ServiceKey often contains '%' which gets double encoded. Best to append manually.

        const ncstUrl = `${KMA_BASE_URL}/getUltraSrtNcst?serviceKey=${serviceKey}&pageNo=1&numOfRows=10&dataType=JSON&base_date=${todayStr}&base_time=${baseTimeNow}&nx=${nx}&ny=${ny}`;
        const ncstRes = await fetch(ncstUrl);
        const ncstJson = await ncstRes.json();

        // Fetch Forecast (getVilageFcst) - For 3 Day
        // Base time: 0200, 0500, 0800, 1100, 1400, 1700, 2000, 2300
        // Find closest previous base time
        const baseTimes = [2, 5, 8, 11, 14, 17, 20, 23];
        const currentHour = dateObj.getHours();
        let fcstBaseHour = baseTimes.reverse().find(h => h <= currentHour) || 23;

        // If current hour < 2, needs yesterday 23.
        let fcstDateStr = todayStr;
        if (currentHour < 2) {
            // Handle yesterday date calc
            const yest = new Date(dateObj);
            yest.setDate(yest.getDate() - 1);
            const yM = String(yest.getMonth() + 1).padStart(2, '0');
            const yD = String(yest.getDate()).padStart(2, '0');
            fcstDateStr = `${yest.getFullYear()}${yM}${yD}`;
            fcstBaseHour = 23;
        }
        const fcstBaseTime = `${String(fcstBaseHour).padStart(2, '0')}00`;

        const fcstUrl = `${KMA_BASE_URL}/getVilageFcst?serviceKey=${serviceKey}&pageNo=1&numOfRows=1000&dataType=JSON&base_date=${fcstDateStr}&base_time=${fcstBaseTime}&nx=${nx}&ny=${ny}`;
        const fcstRes = await fetch(fcstUrl);
        const fcstJson = await fcstRes.json();

        // Process Data
        const currentData = parseNcst(ncstJson); // Helper
        const forecastData = await parseFcst(fcstJson, lat, lng); // Helper

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
        console.error("KMA Fetch Error", e);
        return NextResponse.json({ error: "Failed to fetch from KMA", details: (e as Error).message || String(e) }, { status: 500 });
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
    }).slice(0, 3); // Initial 3 days from Short-term

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
            weatherCode: t.pty > 0
                ? (t.pty === 3 ? 'snowy' : 'rainy')
                : (t.sky >= 4 ? 'cloudy' : (t.sky >= 3 ? 'partly_cloudy' : 'sunny'))
        }))
        .sort((a, b) => parseInt(`${a.date}${a.time}`) - parseInt(`${b.date}${b.time}`));

    // --- Phase 2: Mid-term Forecast Integration ---
    try {
        const midDaily = await getMidTermForecast(lat, lng);
        if (midDaily && midDaily.length > 0) {
            // Append to daily list
            // Short-term: Today, +1, +2. (Total 3 items). Mid starts +3.
            // But verify overlap.
            const existingDates = new Set(daily.map(d => d.date));
            midDaily.forEach(m => {
                if (!existingDates.has(m.date)) {
                    daily.push(m);
                }
            });
            // Sort again
            daily.sort((a, b) => parseInt(a.date) - parseInt(b.date));
        }
    } catch (e) {
        console.warn("Mid-term fetch failed, returning short-term only", e);
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

    let baseDate = new Date(kstDate);

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
    // Note: serviceKey should be injected directly if it is already encoded. 
    // If it's decoded, we should enable encoding. 
    // Assuming KMA_SERVICE_KEY in env is the "Decoding" key (standard practice for lib), we need to encode it?
    // Actually, usually easier to paste Encoded key in Env. 
    // Let's assume Env is Encoded.
    const landUrl = `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidLandFcst?serviceKey=${serviceKey}&numOfRows=10&pageNo=1&dataType=JSON&regId=${landCode}&tmFc=${tmFc}`;
    const tempUrl = `http://apis.data.go.kr/1360000/MidFcstInfoService/getMidTa?serviceKey=${serviceKey}&numOfRows=10&pageNo=1&dataType=JSON&regId=${tempCode}&tmFc=${tmFc}`;

    try {
        const [landRes, tempRes] = await Promise.all([
            fetch(landUrl).then(async r => {
                if (!r.ok) {
                    console.error(`Mid Land Fetch Failed: ${r.status} ${await r.text()}`);
                    return null;
                }
                const text = await r.text();
                // Mid Land Res log removed
                try { return JSON.parse(text); } catch (e) { console.error("Mid Land Parse Error", e); return null; }
            }),
            fetch(tempUrl).then(async r => {
                if (!r.ok) {
                    console.error(`Mid Temp Fetch Failed: ${r.status} ${await r.text()}`);
                    return null;
                }
                const text = await r.text();
                try { return JSON.parse(text); } catch (e) { console.error("Mid Temp Parse Error", e); return null; }
            })
        ]);

        if (!landRes?.response?.body?.items?.item) {
            console.warn("Mid Land Body Empty", JSON.stringify(landRes).substring(0, 200));
        }

        const landItem = landRes?.response?.body?.items?.item?.[0];
        const tempItem = tempRes?.response?.body?.items?.item?.[0];

        if (!landItem || !tempItem) {
            console.warn('[Weather] Mid-term: No landItem or tempItem found');
            return [];
        }

        // Use TODAY (KST) as reference, not baseDate
        // Mid-term forecast provides D+3 ~ D+10 from TODAY
        const todayKST = new Date(utcNow + kstOffset);
        todayKST.setHours(0, 0, 0, 0); // Reset to midnight

        const midDaily = [];
        // KMA Mid-term gives 3day to 10day
        for (let i = 3; i <= 10; i++) {
            // Calculate date string for D+i from TODAY
            const d = new Date(todayKST);
            d.setDate(d.getDate() + i);
            const dateStr = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;

            // Sky: wf3Am, wf3Pm ... wf7, wf8 (Day 8-10 are single value)
            let skyStr = '';
            let pop = 0;

            if (i <= 7) {
                // AM/PM Split available, use PM as representative or average? 
                // Let's use PM for "Day" if simplified, or handle split. 
                // Our UI is simple daily list. Let's use PM if valid, else AM.
                // Or "Am/Pm" strings.
                // KMA returns "맑음", "구름많음", "흐림", "비", "눈" text.
                // We need to map to our types.
                skyStr = landItem[`wf${i}Pm`] || landItem[`wf${i}Am`] || landItem[`wf${i}`] || '맑음';
                pop = landItem[`rnSt${i}Pm`] || landItem[`rnSt${i}Am`] || landItem[`rnSt${i}`] || 0;
            } else {
                skyStr = landItem[`wf${i}`] || '맑음';
                pop = landItem[`rnSt${i}`] || 0;
            }

            // Temp: taMin3, taMax3 ...
            const min = tempItem[`taMin${i}`] ?? null;
            const max = tempItem[`taMax${i}`] ?? null;

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
