import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function findPrestigeRealities() {
    console.log('--- [Investigation] Finding the truth of Prestige Landmarks ---');

    // 1. Find ANY items related to "예당호" or "수덕사"
    const { data: spots, error } = await supabase
        .from('master_places')
        .select('*')
        .or('name.ilike.%예당호%,name.ilike.%수덕사%,name.ilike.%추사%')
        .eq('category', 'SPOT');

    if (error) {
        console.error('DB Error:', error);
        return;
    }

    if (!spots || spots.length === 0) {
        console.log('❌ No spots found even with wide search!');
        return;
    }

    console.log(`🔍 Found ${spots.length} candidate spots.`);
    spots.forEach(s => {
        console.log(`ID: ${s.id} | Name: [${s.name}] | Active: ${s.is_active} | Tier: ${s.raw_data?.prestige_tier}`);
    });
}

findPrestigeRealities().catch(console.error);
