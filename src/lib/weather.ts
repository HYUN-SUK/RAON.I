
// KMA Coordinate Conversion & Forecast
// Ported from Edge Function for Server Actions

export function dfs_xy_conv(code: string, v1: number, v2: number) {
    const RE = 6371.00877; // 地球半径(km)
    const GRID = 5.0; // 格子间距(km)
    const SLAT1 = 30.0; // 投射纬度1(degree)
    const SLAT2 = 60.0; // 投射纬度2(degree)
    const OLON = 126.0; // 基准点经度(degree)
    const OLAT = 38.0; // 基准点纬度(degree)
    const XO = 43; // 基准点X坐标(GRID)
    const YO = 136; // 基准点Y坐标(GRID)

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

export async function getForecast(lat: number, lng: number, dateStr: string) {
    // 1. Convert Lat/Lng to Grid
    const grid = dfs_xy_conv("toXY", lat, lng);
    if (!grid.x || !grid.y) return null;

    // 2. Fetch from internal weather API or use Mock if fetch fails
    try {
        const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || process.env.NEXT_PUBLIC_VERCEL_URL ? `https://${process.env.NEXT_PUBLIC_VERCEL_URL}` : 'http://localhost:3000';
        const targetUrl = `${baseUrl}/api/weather?lat=${lat}&lng=${lng}`;

        const res = await fetch(targetUrl, { next: { revalidate: 3600 } });
        if (!res.ok) {
            console.warn(`[getForecast] Weather API failed with status: ${res.status}`);
            throw new Error("Weather API failed");
        }

        const data = await res.json();
        return data; // Returns { current, daily: [], timeline: [], nx, ny }
    } catch (error) {
        console.error("[getForecast] Error fetching weather, falling back to Open-Meteo:", error);
        try {
            // Open-Meteo Fallback (Manual Sec 4.2)
            const omRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=weather_code,temperature_2m_max,temperature_2m_min&timezone=Asia%2FSeoul`);
            const omData = await omRes.json();
            if (omData.daily) {
                const wmoCode = omData.daily.weather_code[0];
                const tMax = omData.daily.temperature_2m_max[0];
                const tMin = omData.daily.temperature_2m_min[0];

                // WMO Interpretation mapping
                let sky = '맑음';
                let weatherCode = 'sunny';
                if (wmoCode >= 51 && wmoCode <= 82) { sky = '비'; weatherCode = 'rainy'; }
                else if (wmoCode >= 1 && wmoCode <= 48) { sky = '구름많음'; weatherCode = 'cloudy'; }
                else if (wmoCode >= 71 && wmoCode <= 77) { sky = '눈'; weatherCode = 'snowy'; }

                return {
                    current: { temp: (tMax + tMin) / 2, humidity: 50, windSpeed: 2, strPrecipitation: sky === '비' ? '1' : '0' },
                    daily: [{ date: dateStr, min: tMin, max: tMax, pop: sky === '비' ? 60 : 0, weatherCode }],
                    timeline: [{ date: dateStr, time: '1200', temp: (tMax + tMin) / 2, sky, pty: sky === '비' ? 1 : 0, pop: sky === '비' ? 60 : 0, weatherCode }],
                    nx: grid.x, ny: grid.y, 
                    source: 'open-meteo'
                };
            }
        } catch (omErr) {
            console.error("[getForecast] Open-Meteo Fallback failed, using hard mock:", omErr);
        }

        return {
            current: { temp: 15, humidity: 50, windSpeed: 2, strPrecipitation: '0' },
            daily: [
                { date: dateStr, min: 10, max: 20, pop: 0, weatherCode: 'sunny' }
            ],
            timeline: [
                { date: dateStr, time: '1500', temp: 15, sky: '맑음', pty: 0, pop: 0, weatherCode: 'sunny' }
            ],
            nx: grid.x,
            ny: grid.y,
            source: 'hard-mock'
        };
    }
}
