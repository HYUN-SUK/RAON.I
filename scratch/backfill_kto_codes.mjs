import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getAdminCodes } from '../scripts/utils/admin-code-mapping.mjs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function backfillKtoCodes() {
    console.log('🛠 Starting KTO Code Backfill for master_places...');

    // 1. KTO 코드가 없는 TOUR_SPOT 또는 SPOT 카테고리 추출
    const { data: targets, error } = await supabase
        .from('master_places')
        .select('*')
        .eq('category', 'SPOT')
        .is('raw_data->areaCode', null)
        .limit(1000); 

    if (error || !targets || targets.length === 0) {
        console.log('✅ No targets found or error occurred.');
        return;
    }

    console.log(`- Processing ${targets.length} items...`);

    let updatedCount = 0;
    const batch = [];

    for (const item of targets) {
        const { areaCd, signguCd } = getAdminCodes(item.sido, item.sigungu);
        if (areaCd && signguCd) {
            const newRawData = {
                ...item.raw_data,
                areaCode: areaCd,
                sigunguCode: signguCd
            };
            batch.push({
                id: item.id,
                raw_data: newRawData
            });
            updatedCount++;
        }
    }

    if (batch.length > 0) {
        const { error: upsertErr } = await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
        if (upsertErr) console.error('❌ Upsert Error:', upsertErr.message);
        else console.log(`✅ Successfully backfilled ${updatedCount} items.`);
    }
}

backfillKtoCodes().catch(console.error);
