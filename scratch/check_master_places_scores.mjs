import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function checkMasterPlacesScores() {
    console.log('🔍 Checking master_places score updating status...\n');

    // Fetch sample master_places
    const { data: spots } = await supabase
        .from('master_places')
        .select('name, category, trust_score, raw_data, updated_at')
        .eq('category', 'SPOT')
        .limit(10);

    console.log(`Sample SPOT entries in master_places (${spots?.length || 0}):`);
    spots?.forEach(s => {
        console.log(`   - ${s.name} | trust_score: ${s.trust_score} | tier: ${s.raw_data?.tier} | updated_at: ${s.updated_at}`);
    });

    // Fetch sample candidates
    const { data: cands } = await supabase
        .from('smart_plan_candidates')
        .select('name, category, quality_score, penalty_score, final_score, created_at')
        .eq('category', 'SPOT')
        .limit(10);

    console.log(`\nSample SPOT candidates in smart_plan_candidates (${cands?.length || 0}):`);
    cands?.forEach(c => {
        console.log(`   - ${c.name} | quality_score: ${c.quality_score} | penalty: ${c.penalty_score} | final_score: ${c.final_score} | created_at: ${c.created_at}`);
    });
}

checkMasterPlacesScores();
