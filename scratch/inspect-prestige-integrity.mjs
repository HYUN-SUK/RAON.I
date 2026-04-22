import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function inspectPrestigeLoad() {
    console.log('🔍 [Phase 2 Inspection] Verifying Prestige Data Integrity...');

    // 1. Tier 1 Count
    const { count: t1Count } = await supabase
        .from('prestige_landmarks')
        .select('*', { count: 'exact', head: true })
        .eq('tier', 1);

    // 2. Tier 2 Count
    const { count: t2Count } = await supabase
        .from('prestige_landmarks')
        .select('*', { count: 'exact', head: true })
        .eq('tier', 2);

    // 3. Foreign Key Integrity (Links to master_places)
    const { data: orphans } = await supabase
        .from('prestige_landmarks')
        .select('name')
        .is('master_id', null);

    // 4. Protection Shield Verification
    const { count: protectedCount } = await supabase
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .eq('is_protected', true);

    // 5. Sample Check (Recent 5 entries)
    const { data: samples } = await supabase
        .from('prestige_landmarks')
        .select('tier, name, sigungu, master_id')
        .order('created_at', { ascending: false })
        .limit(5);

    console.log('\n--- Inspection Report ---');
    console.log(`✅ Tier 1 (Official 100) Count: ${t1Count}`);
    console.log(`✅ Tier 2 (Regional 8-Sceneries) Count: ${t2Count}`);
    console.log(`✅ Total Prestige Entries: ${t1Count + t2Count}`);
    console.log(`✅ Master Places Shielded (is_protected: true): ${protectedCount}`);
    console.log(`⚠️ Orphaned Entries (No master_id): ${orphans?.length || 0}`);
    
    if (orphans && orphans.length > 0) {
        console.log('   - Sample Orphans:', orphans.slice(0, 3).map(o => o.name).join(', '));
    }

    console.log('\n--- Recent Data Samples ---');
    console.table(samples);
}

inspectPrestigeLoad().catch(console.error);
