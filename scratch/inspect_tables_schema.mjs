import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    const { data: postSample } = await adminClient.from('posts').select('*').limit(1).single();
    console.log('posts sample keys:', Object.keys(postSample || {}));

    const { data: schedSample } = await adminClient.from('user_schedules').select('*').limit(1).single();
    console.log('user_schedules sample keys:', Object.keys(schedSample || {}));
}

inspect();
