
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMissions() {
    const now = new Date().toISOString();
    console.log("Current Time:", now);

    const { data, error } = await supabase
        .from('missions')
        .select('*');

    if (error) {
        console.error("Error:", error);
        return;
    }

    console.log("Current Time:", now);
    console.log(JSON.stringify(data, null, 2));
}

checkMissions();
