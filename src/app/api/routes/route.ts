import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
    try {
        const { origin, destination } = await req.json();
        const apiKey = process.env.KAKAO_REST_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'Missing Kakao API Key' }, { status: 500 });
        }

        // alternatives=true를 통해 1번의 호출로 대안 경로까지 확보 (비용 최적화)
        const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${destination.lng},${destination.lat}&priority=RECOMMEND&alternatives=true`;
        
        const res = await fetch(url, {
            headers: { 'Authorization': `KakaoAK ${apiKey}` }
        });

        if (!res.ok) {
            throw new Error(`Kakao API responded with ${res.status}`);
        }

        const data = await res.json();
        return NextResponse.json(data);
    } catch (error: any) {
        console.error('Route API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
