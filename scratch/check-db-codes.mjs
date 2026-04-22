import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkCodeConsistency() {
    console.log('🔍 Checking lDongSignguCd in master_places...');
    
    const targets = ['종로구', '순천시', '홍성군', '수원시'];
    for (const name of targets) {
        const { data } = await supabase
            .from('master_places')
            .select('sido, sigungu, raw_data->>lDongSignguCd')
            .eq('sigungu', name)
            .limit(1);
        
        if (data && data.length > 0) {
            console.log(`- ${data[0].sido} ${data[0].sigungu}: "${data[0]['?column?'] || data[0].lDongSignguCd}" (Raw value in JSON)`);
        }
    }
}

checkCodeConsistency();
