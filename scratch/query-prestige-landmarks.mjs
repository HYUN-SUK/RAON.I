import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error('Missing required env vars (SUPABASE)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function queryPrestige() {
    console.log('--- Querying Prestige Landmarks for 예산군, 홍성군 ---');
    
    const { data, error } = await supabase
        .from('prestige_landmarks')
        .select('*')
        .in('sigungu', ['예산군', '홍성군'])
        .order('tier', { ascending: true })
        .order('name', { ascending: true });

    if (error) {
        console.error('Error fetching prestige landmarks:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No prestige landmarks found for 예산군, 홍성군.');
        return;
    }

    console.log(`\n| 티어 | 시군구 | 이름 | 주소 |`);
    console.log(`| :--- | :--- | :--- | :--- |`);
    data.forEach(item => {
        console.log(`| Tier ${item.tier} | ${item.sigungu} | ${item.name} | ${item.address} |`);
    });
    
    console.log(`\nTotal: ${data.length} items`);
}

queryPrestige().catch(console.error);
