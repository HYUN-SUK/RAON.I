import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectColumns() {
    const { data, error } = await adminClient.from('likes').select('*').limit(1);
    console.log('likes row:', data, error);

    const { data: configData, error: configErr } = await adminClient.from('system_config').select('*').limit(1);
    console.log('system_config row:', configData, configErr);
}

inspectColumns();
