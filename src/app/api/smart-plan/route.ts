import { NextRequest, NextResponse } from 'next/server';
import { generatePersonalizedSmartPlan } from '@/lib/smartPlan';

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId, location, startDate, endDate, origin, predefinedMidpoint, mode, travelType, routeData } = body;

        const plan = await generatePersonalizedSmartPlan(
            userId,
            location,
            new Date(startDate),
            new Date(endDate),
            origin,
            predefinedMidpoint,
            mode,
            travelType,
            routeData
        );

        return NextResponse.json(plan);
    } catch (e: any) {
        console.error('[SmartPlan API] Error:', e);
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
