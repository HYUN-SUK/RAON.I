import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectScoringRotation() {
    console.log('🔍 Inspecting Daily Rotation Scoring Logic & DB Scores...\n');

    // 1. Inspect master_places trust_score & quality_score across categories
    const categories = ['SPOT', 'RESTAURANT', 'MART', 'HOSPITAL', 'GAS_STATION'];

    console.log('1. master_places Table Score Distribution by Category:');
    for (const cat of categories) {
        const { data: samplePlaces } = await supabase
            .from('master_places')
            .select('name, category, trust_score, quality_score, raw_data, updated_at')
            .eq('category', cat)
            .order('trust_score', { ascending: false })
            .limit(5);

        console.log(`\n--- [Category: ${cat}] (Sample Top 5 in master_places) ---`);
        samplePlaces?.forEach((p, i) => {
            console.log(`   [${i+1}] ${p.name} | trust_score: ${p.trust_score} | quality_score: ${p.quality_score} | badges: [${(p.raw_data?.badges || []).join(', ')}] | updated_at: ${p.updated_at}`);
        });
    }

    // 2. Inspect smart_plan_candidates score fields (quality_score, penalty_score, final_score)
    console.log('\n2. smart_plan_candidates Table Score Distribution (SPOT vs Others):');
    for (const cat of categories) {
        const { data: candSample } = await supabase
            .from('smart_plan_candidates')
            .select('name, category, quality_score, penalty_score, final_score, raw_data, created_at')
            .eq('category', cat)
            .order('final_score', { ascending: false })
            .limit(5);

        console.log(`\n--- [Candidate Category: ${cat}] (Sample Top 5 in smart_plan_candidates) ---`);
        candSample?.forEach((c, i) => {
            console.log(`   [${i+1}] ${c.name} | quality_score: ${c.quality_score} | penalty: ${c.penalty_score} | final_score: ${c.final_score} | created_at: ${c.created_at}`);
        });
    }
}

inspectScoringRotation();
