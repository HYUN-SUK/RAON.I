import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkUserTokens() {
    const userId = 'f3e1e14c-423f-477a-b07b-4ebcb7951e86';

    const { data: userScheds } = await supabase
        .from('user_schedules')
        .select('*')
        .eq('user_id', userId);

    console.log(`유저의 일정: ${userScheds?.map(s => s.campground_name + ' (' + s.check_in + ')').join(', ')}`);

    const { data: tokens } = await supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', userId);

    console.log(`\n유저의 등록된 push_tokens 총 ${tokens?.length}개:`);
    for (const t of (tokens || [])) {
        console.log(JSON.stringify(t, null, 2));
    }
}

checkUserTokens();
