import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectFullPlan() {
    const { data: s } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('id', 'fccafb52-56d3-41cd-b90c-78cbacfa9359')
        .single();

    console.log('Plan keys:', Object.keys(s.smart_plan_data || {}));
    console.log('is_preview:', s.smart_plan_data?.is_preview);
    console.log('target_date:', s.smart_plan_data?.target_date);
    console.log('narration:', s.smart_plan_data?.narration);
    console.log('stageIntros:', s.smart_plan_data?.stageIntros);
    console.log('itemListElement:', s.smart_plan_data?.itemListElement?.map(c => ({ name: c.name, category: c.category })));
    console.log('alternatives keys:', Object.keys(s.smart_plan_data?.alternatives || {}));
}

inspectFullPlan();
