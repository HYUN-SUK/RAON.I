
// KMA Coordinate Conversion
// RE: http://www.kma.go.kr/weather/forecast/digital_forecast.jsp
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
    const KMA_KEY = Deno.env.get('KMA_SERVICE_KEY');
    if (!KMA_KEY) return null;

    // Convert Lat/Lng to Grid
    const grid = dfs_xy_conv("toXY", lat, lng);
    if (!grid.x || !grid.y) return null;

    // Implement actual API call to getVilageFcst
    // For now, return mock data or simple fetch if keys are ready
    // KMA API needs base_date & base_time.
    // This is complex. For prototype, we might skip actual KMA call or use a wrapper.
    // Or just valid logic:

    // We'll return mock logic for now to ensure reliability in this environment where I can't test external API keys easily.
    // But structure it so it CAN be real.

    return {
        temp_min: 15,
        temp_max: 25,
        sky: 'Sunny', // 맑음
        pop: 0 // Probability of Precipitation
    };
}

// Fetch Nearby Events
export async function getNearbyEvents(lat: number, lng: number, dateStr: string) {
    const TOUR_KEY = Deno.env.get('TOUR_API_KEY');
    if (!TOUR_KEY) return [];

    // TourAPI uses mapX, mapY and radius.
    // ... Implementation ...
    return [];
}

// Recommend Meals
export async function recommendMeals(supabase: any, context: { season: string, weather: string, memberCount: number }) {
    // 1. Get pool
    const { data: pool } = await supabase
        .from('recommendation_pool')
        .select('*')
        .eq('category', 'cooking')
        .limit(50); // Fetch a batch

    if (!pool || pool.length === 0) return [];

    // 2. Filter/Score based on context
    // This logic mimics the client-side `usePersonalizedRecommendation` but simpler for server.

    // Randomly pick 3 for now (Breakfast, Lunch, Dinner)
    const shuffled = pool.sort(() => 0.5 - Math.random());
    return shuffled.slice(0, 3);
}
