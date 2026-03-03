import { NextResponse } from 'next/server';
import { generateSmartPlan } from '@/lib/smartPlan';

export async function GET() {
    try {
        const res = await generateSmartPlan(
            { description: '테스트 유저', topTags: [], guestDetails: { adults: 2, kids: { preschool: 0, elementary: 0, teen: 0 } } },
            { lat: 36.6719, lng: 126.8429 }, // 예산군청(캠핑장이라고 가정)
            new Date(),
            new Date(Date.now() + 86400000 * 2),
            { lat: 37.5665, lng: 126.9780 } // 서울(출발지)
        );
        return NextResponse.json(res);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
