import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
    try {
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
        );
        const { data, error } = await supabase.from('smart_plan_facts').select('id, category, name, lat, lng');
        return NextResponse.json({ data, error });
    } catch (e: any) {
        return NextResponse.json({ error: e.message }, { status: 500 });
    }
}
