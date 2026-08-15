import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspectPolicies() {
    // Check system_config update with anonClient
    const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

    const { data: before } = await anonClient.from('system_config').select('*').eq('id', 1).single();
    console.log('Before anon update attempt:', before);

    const { data: updateRes, error: updateErr } = await anonClient
        .from('system_config')
        .update({ maintenance_message: 'HACKED_BY_ANON' })
        .eq('id', 1)
        .select();

    console.log('Anon update result:', updateRes, updateErr);

    const { data: after } = await anonClient.from('system_config').select('*').eq('id', 1).single();
    console.log('After anon update check:', after);
}

inspectPolicies();
