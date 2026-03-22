import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function testUpsert() {
    const testFact = {
        id: '123e4567-e89b-12d3-a456-426614174000',
        api_source: 'TEST_DIAG',
        category: 'MART',
        name: 'Test Mart 1',
        address: '충남 예산 어딘가',
        lat: 36.65,
        lng: 126.68,
        trust_score: 50,
        description: 'Test diag',
        raw_data: { test: true }
    };
    
    const { data, error } = await supabase.from('smart_plan_facts').upsert([testFact], { onConflict: 'id' });
    console.log("Upsert Error:", error);

    // Clean up
    await supabase.from('smart_plan_facts').delete().eq('id', '123e4567-e89b-12d3-a456-426614174000');
}

testUpsert();
