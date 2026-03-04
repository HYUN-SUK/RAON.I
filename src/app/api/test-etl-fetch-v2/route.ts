import { NextResponse } from 'next/server';

export async function GET() {
    let logs: any[] = [];
    const publicApiKey = process.env.PUBLIC_DATA_API_KEY;
    const isWithinServiceArea = (lat: number, lng: number) => {
        const YESAN_LAT = 36.67;
        const YESAN_LNG = 126.84;
        const dist = Math.sqrt(Math.pow(lat - YESAN_LAT, 2) + Math.pow(lng - YESAN_LNG, 2));
        return dist <= 0.5;
    };

    try {
        const q0 = encodeURIComponent('충청남도');
        const q1 = encodeURIComponent('예산군');
        const nmcRes = await fetch(`http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&Q0=${q0}&Q1=${q1}&pageNo=1&numOfRows=100&_type=json`);
        const nmcData = await nmcRes.json();

        const items = Array.isArray(nmcData.response?.body?.items?.item) ? nmcData.response.body.items.item : [nmcData.response?.body?.items?.item].filter(Boolean);
        const valid = items.filter((item: any) => isWithinServiceArea(parseFloat(item.wgs84Lat), parseFloat(item.wgs84Lon)));
        logs.push({ source: 'NMC', fetched: items.length, valid: valid.length });
    } catch (e: any) { logs.push({ source: 'NMC', err: e.message }) }

    try {
        const smbaRes = await fetch(`http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong?serviceKey=${publicApiKey}&pageNo=1&numOfRows=100&divId=signguCd&key=44810&type=json`);
        const smbaData = await smbaRes.json();
        const items = Array.isArray(smbaData.body?.items) ? smbaData.body.items : [smbaData.body?.items].filter(Boolean);
        const valid = items.filter((item: any) => isWithinServiceArea(parseFloat(item.lat), parseFloat(item.lon)));
        logs.push({ source: 'SMBA', fetched: items.length, valid: valid.length });
    } catch (e: any) { logs.push({ source: 'SMBA', err: e.message }) }

    try {
        const martRes = await fetch(`http://apis.data.go.kr/B553077/api/open/sdsc2/storeListInDong?serviceKey=${publicApiKey}&pageNo=1&numOfRows=1000&divId=ctprvnCd&key=44&type=json`);
        const martData = await martRes.json();
        const items = Array.isArray(martData.body?.items) ? martData.body.items : [martData.body?.items].filter(Boolean);
        const valid = items.filter((item: any) => (item.bizesNm?.includes('이마트') || item.bizesNm?.includes('홈플러스') || item.bizesNm?.includes('하나로마트')) && isWithinServiceArea(parseFloat(item.lat), parseFloat(item.lon)));
        logs.push({ source: 'MART', fetched: items.length, valid: valid.length });
    } catch (e: any) { logs.push({ source: 'MART', err: e.message }) }

    return NextResponse.json(logs);
}
