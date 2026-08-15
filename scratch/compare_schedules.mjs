import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function compareBadgeData() {
    console.log('🔍 FORENSIC BADGE COMPARISON: 해남 vs 강릉 in smart_plan_candidates...\n');

    // 1. Fetch candidates for 해남
    const { data: haenamCands } = await supabase
        .from('smart_plan_candidates')
        .select('*')
        .eq('reservation_id', '9c2d19ef-8777-4e18-893e-611230c70fef')
        .eq('category', 'RESTAURANT');

    console.log(`=== 해남 Restaurant Candidates (${haenamCands?.length || 0}) ===`);
    haenamCands?.forEach((c, idx) => {
        console.log(`[${idx+1}] ${c.name}`);
        console.log(`     api_source column: "${c.api_source}"`);
        console.log(`     raw_data.badges:`, c.raw_data?.badges);
        console.log(`     raw_data.description:`, c.raw_data?.description);
        console.log(`     raw_data.api_source:`, c.raw_data?.api_source);
        console.log('----------------------------------------------------');
    });

    // 2. Fetch candidates for 강릉
    const { data: gangneungCands } = await supabase
        .from('smart_plan_candidates')
        .select('*')
        .eq('reservation_id', '6933ec4b-4646-46b0-a768-04d1d181f0cd')
        .eq('category', 'RESTAURANT');

    console.log(`\n=== 강릉 Restaurant Candidates (${gangneungCands?.length || 0}) ===`);
    gangneungCands?.forEach((c, idx) => {
        console.log(`[${idx+1}] ${c.name}`);
        console.log(`     api_source column: "${c.api_source}"`);
        console.log(`     raw_data.badges:`, c.raw_data?.badges);
        console.log(`     raw_data.description:`, c.raw_data?.description);
        console.log(`     raw_data.api_source:`, c.raw_data?.api_source);
        console.log('----------------------------------------------------');
    });
}

compareBadgeData();
