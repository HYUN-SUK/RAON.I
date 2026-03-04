import { NextResponse } from 'next/server';

export async function GET() {
    let logs = [];
    const publicApiKey = process.env.PUBLIC_DATA_API_KEY;
    const isWithinServiceArea = (lat: number, lng: number) => {
        const YESAN_LAT = 36.67;
        const YESAN_LNG = 126.84;
        const dist = Math.sqrt(Math.pow(lat - YESAN_LAT, 2) + Math.pow(lng - YESAN_LNG, 2));
        return dist <= 0.5;
    };

    try {
        const nmcUrl = `http://apis.data.go.kr/B552657/ErmctInfoInqireService/getEmrrmRltmUsefulSckbdInfoInqire?serviceKey=${publicApiKey}&STAGE1=충청남도&STAGE2=예산군&pageNo=1&numOfRows=100&_type=json`;
        const nmcRes = await fetch(nmcUrl);
        const text = await nmcRes.text();
        logs.push({ source: 'NMC', data: text.substring(0, 200) });
    } catch (e: any) { logs.push({ source: 'NMC', err: e.message }) }

    try {
        const tourRes = await fetch(`http://apis.data.go.kr/B551011/KorService1/areaBasedList1?serviceKey=${publicApiKey}&numOfRows=100&pageNo=1&MobileOS=ETC&MobileApp=AppTest&_type=json&contentTypeId=12&areaCode=34&sigunguCode=11`);
        const text = await tourRes.text();
        logs.push({ source: 'TOUR_SPOT', data: text.substring(0, 200) });
    } catch (e: any) { logs.push({ source: 'TOUR', err: e.message }) }

    return NextResponse.json(logs);
}
