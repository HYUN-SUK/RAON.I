
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

    // 2. KMA API (Simplify for now, or Mock if similar to Deno)
    // Using Mock for stability, same as Edge Function currently
    return {
        temp_min: 15,
        temp_max: 25,
        sky: 'Sunny',
        pop: 0
    };
}
