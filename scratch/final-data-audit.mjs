import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function finalDataAudit() {
    console.log('🧐 [Final Audit] Verifying Nationwide KTO Popularity Data...');

    // 1. Get Total Unique Sigungu Count in Master DB
    const { data: allRegs } = await supabase
        .from('master_places')
        .select('sido, sigungu');
    
    const uniqueTotal = new Set(allRegs.map(r => `${r.sido}|${r.sigungu}`)).size;
    console.log(`- Total Unique Regions in DB: ${uniqueTotal}`);

    // 2. Get Count of Regions with 'kto_official' metadata
    const { data: ktoRegs } = await supabase
        .from('master_places')
        .select('sido, sigungu')
        .not('raw_data->kto_official', 'is', null);

    const uniqueKto = new Set(ktoRegs.map(r => `${r.sido}|${r.sigungu}`));
    console.log(`- Regions with KTO Official Data: ${uniqueKto.size}`);

    const coverage = ((uniqueKto.size / uniqueTotal) * 100).toFixed(1);
    console.log(`📊 Final Coverage: ${coverage}%`);

    // 3. Sample Check for specific previous failure points
    const samples = ['전라남도 순천시', '강원특별자치도 정선군', '충청남도 홍성군', '서울특별시 종로구'];
    console.log('\n🔍 [Sample Check]');
    for (const s of samples) {
        const [sido, sigungu] = s.split(' ');
        const { data } = await supabase
            .from('master_places')
            .select('raw_data->kto_official')
            .eq('sido', sido)
            .ilike('sigungu', `%${sigungu}%`)
            .not('raw_data->kto_official', 'is', null)
            .limit(1);
        
        if (data && data.length > 0) {
            console.log(`✅ ${s}: FOUND (Rank: ${data[0].kto_official.rank})`);
        } else {
            console.log(`❌ ${s}: NOT FOUND`);
        }
    }

    if (coverage >= 99) {
        console.log('\n✨ [Conclusion] Nationwide Data Load is SUCCESSFULLY COMPLETE!');
    } else {
        console.log('\n⚠️ [Conclusion] Some regions are still missing. Manual intervention might be needed.');
    }
}

finalDataAudit();
