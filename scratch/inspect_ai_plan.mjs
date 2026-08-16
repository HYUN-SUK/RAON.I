import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectAiPlan() {
    const { data: s } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', '34d239ff-f472-4111-8593-0cfcc830b737')
        .single();

    const plan = s.smart_plan_data?.ai_plan;
    console.log('Keys in ai_plan:', Object.keys(plan || {}));
    console.log('weatherBriefing in ai_plan:', JSON.stringify(plan?.weatherBriefing, null, 2));
}

inspectAiPlan();
