import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkAlignment() {
    console.log('\n--- RAONAI 7.1.1 Specs Audit (Detailed) ---');
    
    // 1. 카테고리/소스별 분포 확인
    const { data: counts, error } = await supabase.from('master_places').select('api_source, category');
    if (error) { console.error(error); return; }

    const summary = counts.reduce((acc, curr) => {
        const key = `${curr.category} | ${curr.api_source}`;
        acc[key] = (acc[key] || 0) + 1;
        return acc;
    }, {});

    console.log('\n[Current Distribution]');
    console.table(Object.entries(summary).map(([k, v]) => {
        const [cat, src] = k.split(' | ');
        return { Category: cat, Source: src, Count: v };
    }));

    // 2. 샘플 레코드 정밀 검증 (v5 ID, location, trust_score)
    const { data: samples } = await supabase.from('master_places')
        .select('id, api_source, category, name, address, trust_score, location')
        .limit(5);

    console.log('\n[Sample Record Detail Verification]');
    samples.forEach(s => {
        const isUUID = s.id.length === 36;
        const hasLoc = s.location !== null;
        console.log(`- ${s.name} (${s.api_source}): ID_OK=${isUUID}, Loc_OK=${hasLoc}, Score=${s.trust_score}`);
    });

    // 3. 7.1.1 매핑 규칙 위반 여부 체크
    const violations = counts.filter(c => {
        if (c.api_source.includes('MART') && c.category !== 'MART') return true;
        if (c.api_source.includes('RESTAURANT') && c.category !== 'RESTAURANT') return true;
        if (c.api_source === 'SMBA_BAEK' && c.category !== 'RESTAURANT') return true;
        return false;
    });

    if (violations.length === 0) {
        console.log('\n✅ 7.1.1 All Mapping Rules are being followed strictly.');
    } else {
        console.warn(`\n⚠️ Found ${violations.length} mapping violations!`);
    }
}

checkAlignment();
