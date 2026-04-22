import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function deepInvestigation() {
    const samples = ['서울숲', '경복궁', '익선동', '창덕궁', '자라섬'];
    console.log('--- [Deep Investigation] Searching samples across entire DB ---');

    for (const name of samples) {
        const { data, error } = await supabase
            .from('master_places')
            .select('name, sigungu, address, category, api_source')
            .ilike('name', `%${name}%`)
            .limit(5);

        if (error) {
            console.error(`Error searching ${name}:`, error.message);
            continue;
        }

        console.log(`\n🔍 Search results for "${name}":`);
        if (data && data.length > 0) {
            data.forEach(d => console.log(` - [${d.category}] ${d.name} (${d.sigungu}) | Source: ${d.api_source}`));
        } else {
            console.log(` ❌ No results found for "${name}" in entire master_places table.`);
        }
    }
}

deepInvestigation().catch(console.error);
