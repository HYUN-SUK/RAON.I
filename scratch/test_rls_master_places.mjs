import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function testRLS() {
    console.log("=== master_places RLS & API Key 권한 테스트 ===");

    // 1. Anon Key 클라이언트
    const anonClient = createClient(supabaseUrl, anonKey);
    // 2. Service Role Key 클라이언트
    const serviceClient = createClient(supabaseUrl, serviceKey);

    const aliases = ['경기도', '경기'];
    const source = 'SAFE_RESTAURANT';

    // Anon Key 조회
    const { count: anonCount, error: anonErr } = await anonClient
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .in('sido', aliases)
        .eq('api_source', source)
        .eq('is_active', true);

    // Service Role Key 조회
    const { count: svcCount, error: svcErr } = await serviceClient
        .from('master_places')
        .select('*', { count: 'exact', head: true })
        .in('sido', aliases)
        .eq('api_source', source)
        .eq('is_active', true);

    console.log("[ANON 클라이언트 결과]");
    console.log("Error:", anonErr);
    console.log("Count:", anonCount);

    console.log("\n[SERVICE ROLE 클라이언트 결과]");
    console.log("Error:", svcErr);
    console.log("Count:", svcCount);
}

testRLS();
