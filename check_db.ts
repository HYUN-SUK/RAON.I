
import fs from 'fs';
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function check() {
    const { data, error } = await supabase
        .from('recommendation_pool')
        .select('*')
        .ilike('title', '%아이 동반%')
        .limit(1);

    if (error) {
        fs.writeFileSync('db_check.txt', 'Error: ' + JSON.stringify(error));
    } else {
        const item = data[0];
        const output = `Keys: ${Object.keys(item).join(', ')}\nDifficulty: ${item.difficulty}\nTitle: ${item.title}`;
        fs.writeFileSync('db_check.txt', output);
    }
}

check();
