
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissions()    // check time
{
    const now = new Date();

    const { data, error } = await supabase
        .from('missions')
        .select('*');

    if (error) {
        console.error("Error:", error);
        return;
    }

    if (!data || data.length === 0) {
        return;
    };
}

checkMissions();
