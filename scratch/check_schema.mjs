import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const s = createClient(process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

// Test 1: SELECT
const { data, error } = await s.from('smart_plan_candidates').select('id, fact_id, name, category').limit(3);
if (error) console.log('❌ SELECT failed:', error.message);
else console.log('✅ SELECT OK, rows:', data.length);

// Test 2: INSERT (dry run)
const { error: insErr } = await s.from('smart_plan_candidates').upsert({
    reservation_id: '00000000-0000-0000-0000-000000000001',
    fact_id: '00000000-0000-0000-0000-000000000002',
    category: 'TEST', name: 'schema_cache_test', quality_score: 0, final_score: 0
}, { onConflict: 'reservation_id,fact_id' });

if (insErr) console.log('❌ UPSERT failed:', insErr.message);
else {
    console.log('✅ UPSERT OK - schema cache resolved!');
    // Cleanup
    await s.from('smart_plan_candidates').delete().eq('name', 'schema_cache_test');
    console.log('🧹 Test row cleaned up.');
}
