import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function patchPrestigeTier() {
    console.log('💎 Patching prestige tier info into master_places...');

    // 1. Get all prestige landmarks
    const { data: prestigeList, error: pError } = await supabase
        .from('prestige_landmarks')
        .select('master_id, tier')
        .not('master_id', 'is', null);

    if (pError) {
        console.error('Error fetching prestige list:', pError.message);
        return;
    }

    console.log(`- Found ${prestigeList.length} prestige mappings. Starting patch...`);

    let count = 0;
    for (const item of prestigeList) {
        const { data: spot, error: fError } = await supabase
            .from('master_places')
            .select('raw_data')
            .eq('id', item.master_id)
            .single();

        if (spot) {
            const newRaw = { 
                ...spot.raw_data, 
                prestige: { tier: item.tier, updated_at: new Date().toISOString() } 
            };
            await supabase.from('master_places').update({ raw_data: newRaw }).eq('id', item.master_id);
            count++;
            if (count % 100 === 0) process.stdout.write(`.` );
        }
    }

    console.log(`\n✅ Successfully patched ${count} spots with prestige tier info.`);
}

patchPrestigeTier().catch(console.error);
