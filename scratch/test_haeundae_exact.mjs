import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

// smartPlan.ts 의 generatePreviewSmartPlan 완벽 복제 실행
import { generatePreviewSmartPlan } from '../src/lib/smartPlan.ts';

async function testHaeundaeExact() {
    const loc = { lat: 35.1609477290535, lng: 129.167194019805 };
    const start = new Date('2026-08-25');
    const end = new Date('2026-08-26');

    console.log('--- generatePreviewSmartPlan 직접 호출 ---');
    const plan = await generatePreviewSmartPlan(loc, start, end);
    console.log('Plan is_preview:', plan.is_preview);
    console.log('Plan itemListElement:', plan.itemListElement.map(c => ({ name: c.name, category: c.category, distance: c.distanceKm })));
}

testHaeundaeExact();
