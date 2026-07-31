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

        // 1. 산악/비차도 구역 1차 프리셋 & 카카오 동적 보정 (1차 시도)
        let refinedDest = await resolveDestinationCoords(destination, destinationName, apiKey);

        // 2. alternatives=true를 통해 대안 경로까지 확보 (비용 최적화)
        let url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${refinedDest.lng},${refinedDest.lat}&priority=RECOMMEND&alternatives=true`;
        
        let res = await fetch(url, {
            headers: { 'Authorization': `KakaoAK ${apiKey}` }
        });

        // 3. 만약 1차 경로 탐색이 실패한 경우 (예: 비차도/오지로 인한 400 에러 발생)
        // 2차 Fallback: 강제 동적 주차장 검색 모드(forceDynamicSearch = true)로 좌표 재보정 후 재시도
        if (!res.ok || res.status === 400) {
            console.warn(`[Route API] Primary pathfinding failed with status ${res.status}. Retrying with force PK6 fallback...`);
            
            refinedDest = await resolveDestinationCoords(destination, destinationName, apiKey, true);
            url = `https://apis-navi.kakaomobility.com/v1/directions?origin=${origin.lng},${origin.lat}&destination=${refinedDest.lng},${refinedDest.lat}&priority=RECOMMEND&alternatives=true`;
            
            res = await fetch(url, {
                headers: { 'Authorization': `KakaoAK ${apiKey}` }
            });
            
            if (!res.ok) {
                throw new Error(`Kakao API responded with ${res.status} even after PK6 fallback`);
            }
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
