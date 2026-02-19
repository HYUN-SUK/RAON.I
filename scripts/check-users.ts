import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY!
);

async function check() {
    const { data: users, error } = await supabase.from('users').select('id').limit(5);
    console.log('Users:', users);
    console.log('Error:', error);
}

check();
