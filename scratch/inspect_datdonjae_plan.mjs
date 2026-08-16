import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectDatdonjaePlan() {
    const { data: s } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', '34d239ff-f472-4111-8593-0cfcc830b737')
        .single();

    console.log('Keys in smart_plan_data:', Object.keys(s.smart_plan_data || {}));
    console.log('is_preview:', s.smart_plan_data?.is_preview);
    console.log('weather in smart_plan_data:', s.smart_plan_data?.weather);
    console.log('weatherBriefing in smart_plan_data:', s.smart_plan_data?.weatherBriefing);
    console.log('narration:', s.smart_plan_data?.narration);
}

inspectDatdonjaePlan();
