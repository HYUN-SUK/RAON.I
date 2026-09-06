
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
        let baseUrl = 'http://localhost:3000';
        if (process.env.NEXT_PUBLIC_SITE_URL) {
            baseUrl = process.env.NEXT_PUBLIC_SITE_URL.startsWith('http')
                ? process.env.NEXT_PUBLIC_SITE_URL
                : `https://${process.env.NEXT_PUBLIC_SITE_URL}`;
        } else if (process.env.NEXT_PUBLIC_VERCEL_URL) {
            baseUrl = `https://${process.env.NEXT_PUBLIC_VERCEL_URL}`;
        }
        const targetUrl = `${baseUrl}/api/weather?lat=${lat}&lng=${lng}`;

        const res = await fetch(targetUrl, { next: { revalidate: 14400 } });
        if (!res.ok) {
            console.warn(`[getForecast] Weather API failed with status: ${res.status}`);
            throw new Error("Weather API failed");
        }

        const data = await res.json();
        return data; // Returns { current, daily: [], timeline: [], nx, ny }
    } catch (error) {
        console.error("[getForecast] Error fetching weather, falling back to Open-Meteo:", error);
        try {
            // Open-Meteo Fallback (10-Day Full Parse)
            const omRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,wind_speed_10m,wind_direction_10m,weather_code&hourly=temperature_2m,precipitation_probability,precipitation,wind_speed_10m,wind_direction_10m,relative_humidity_2m,cloud_cover,weather_code&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Asia%2FSeoul&wind_speed_unit=ms&forecast_days=10`);
            const omData = await omRes.json();
            
            if (omData && omData.daily && omData.daily.time) {
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

                const dailyList: any[] = [];
                for (let i = 0; i < omData.daily.time.length; i++) {
                    const cleanD = omData.daily.time[i].replace(/-/g, '');
                    dailyList.push({
                        date: cleanD,
                        min: Math.round(omData.daily.temperature_2m_min[i]),
                        max: Math.round(omData.daily.temperature_2m_max[i]),
                        pop: omData.daily.precipitation_probability_max[i] || 0,
                        weatherCode: mapWeatherCode(omData.daily.weather_code[i])
                    });
                }

                const timelineList: any[] = [];
                if (omData.hourly && omData.hourly.time) {
                    for (let i = 0; i < omData.hourly.time.length; i++) {
                        const timeIso = omData.hourly.time[i];
                        const datePart = timeIso.substring(0, 10).replace(/-/g, '');
                        const hourPart = timeIso.substring(11, 13) + '00';

                        let sky = 1;
                        const cover = omData.hourly.cloud_cover ? omData.hourly.cloud_cover[i] : 0;
                        if (cover >= 70) sky = 4;
                        else if (cover >= 30) sky = 3;

                        timelineList.push({
                            date: datePart,
                            time: hourPart,
                            temp: Math.round(omData.hourly.temperature_2m[i]),
                            sky,
                            pty: (omData.hourly.precipitation && omData.hourly.precipitation[i] > 0) ? 1 : 0,
                            pop: omData.hourly.precipitation_probability ? omData.hourly.precipitation_probability[i] : 0,
                            wsd: omData.hourly.wind_speed_10m ? Math.round(omData.hourly.wind_speed_10m[i] * 10) / 10 : 1.5,
                            vec: (omData.hourly.wind_direction_10m && omData.hourly.wind_direction_10m[i] != null) ? omData.hourly.wind_direction_10m[i] : 225,
                            reh: omData.hourly.relative_humidity_2m ? omData.hourly.relative_humidity_2m[i] : 50,
                            weatherCode: mapWeatherCode(omData.hourly.weather_code[i])
                        });
                    }
                }

                const currTemp = omData.current ? Math.round(omData.current.temperature_2m) : (dailyList[0].min + dailyList[0].max) / 2;
                const currHumid = omData.current ? omData.current.relative_humidity_2m : 50;
                const currWind = omData.current ? omData.current.wind_speed_10m : 2;

                return {
                    current: { temp: currTemp, humidity: currHumid, windSpeed: currWind, strPrecipitation: '0' },
                    daily: dailyList,
                    timeline: timelineList,
                    nx: grid.x, ny: grid.y,
                    source: 'open-meteo-full'
                };
            }
        } catch (omErr) {
            console.error("[getForecast] Open-Meteo Fallback failed, using hard mock:", omErr);
        }

        return {
            current: { temp: 15, humidity: 50, windSpeed: 2, strPrecipitation: '0' },
            daily: [
                { date: dateStr.replace(/-/g, ''), min: 10, max: 20, pop: 0, weatherCode: 'sunny' }
            ],
            timeline: [
                { date: dateStr.replace(/-/g, ''), time: '1500', temp: 15, sky: '맑음', pty: 0, pop: 0, weatherCode: 'sunny' }
            ],
            nx: grid.x,
            ny: grid.y,
            source: 'hard-mock'
        };
    }
}
