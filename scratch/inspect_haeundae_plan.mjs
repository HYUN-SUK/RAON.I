import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectHaeundaePlan() {
    const { data: schedule } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', 'fccafb52-56d3-41cd-b90c-78cbacfa9359')
        .single();

    console.log('--- DB에 저장된 해운대센트럴호텔 smart_plan_data ---');
    console.log(JSON.stringify(schedule.smart_plan_data, null, 2));
}

inspectHaeundaePlan();
