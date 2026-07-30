import { NextRequest, NextResponse } from 'next/server';
import { resolveDestinationCoords } from '@/utils/mountainDestinationResolver';

export async function POST(req: NextRequest) {
    try {
        const { origin, destination, destinationName } = await req.json();
        const apiKey = process.env.KAKAO_REST_API_KEY;

        if (!apiKey) {
            return NextResponse.json({ error: 'Missing Kakao API Key' }, { status: 500 });
        }

        if (!origin || !origin.lat || !origin.lng || !destination || !destination.lat || !destination.lng) {
            return NextResponse.json({ error: 'Invalid origin or destination coordinates' }, { status: 400 });
        }

        // 1. 산악/비차도 구역 1차 프리셋 & 2차 카카오 동적 인근 주차장 탐색 자동 보정
        const refinedDest = await resolveDestinationCoords(destination, destinationName, apiKey);

        // 2. alternatives=true를 통해 1번의 호출로 대안 경로까지 확보 (비용 최적화)
        const url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${refinedDest.lng},${refinedDest.lat}&priority=RECOMMEND&alternatives=true`;
        
        const res = await fetch(url, {
            headers: { 'Authorization': `KakaoAK ${apiKey}` }
        });

        if (!res.ok) {
            throw new Error(`Kakao API responded with ${res.status}`);
        }

        const data = await res.json();

        // 3. fare 및 sections 객체 널-가드 안전 래핑
        if (data.routes && Array.isArray(data.routes)) {
            data.routes = data.routes.map((route: any) => {
                const summary = route.summary || {};
                const fare = summary.fare || {};
                return {
                    ...route,
                    summary: {
                        ...summary,
                        fare: {
                            toll: typeof fare.toll === 'number' ? fare.toll : 0,
                            taxi: typeof fare.taxi === 'number' ? fare.taxi : 0
                        }
                    }
                };
            });
        }

        // 4. 보정 정보 래핑 반환
        return NextResponse.json({
            ...data,
            refinedDestination: refinedDest
        });
    } catch (error: any) {
        console.error('Route API Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
