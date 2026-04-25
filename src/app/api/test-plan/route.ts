import { NextResponse } from 'next/server';
import { generatePersonalizedSmartPlan } from '@/lib/smartPlan';

export async function GET() {
    try {
        const res = await generatePersonalizedSmartPlan(
            'test-user-id',
            { lat: 36.6719, lng: 126.8429 },
            new Date(),
            new Date(Date.now() + 86400000 * 2),
            { lat: 37.5665, lng: 126.9780 }
        );
        return NextResponse.json(res);
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
