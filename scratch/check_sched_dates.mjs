import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkScheduleDates() {
    const { data: schedule } = await supabase
        .from('user_schedules')
        .select('id, campground_name, created_at, updated_at, smart_plan_data')
        .eq('id', 'fccafb52-56d3-41cd-b90c-78cbacfa9359')
        .single();

    console.log('해운대센트럴호텔 일정 생성/수정 시간:', {
        created_at: schedule.created_at,
        updated_at: schedule.updated_at,
        has_smart_plan: !!schedule.smart_plan_data
    });
}

checkScheduleDates();
