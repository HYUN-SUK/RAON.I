import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getAdminCodes } from '../scripts/utils/admin-code-mapping.mjs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function backfillKtoCodes() {
    console.log('🚀 Starting KTO Code Backfill (v12.3 - High Speed Batch Mode)');

    let totalUpdated = 0;
    let hasMore = true;

    while (hasMore) {
        // 1. KTO 코드가 없는 SPOT 카테고리 500건씩 추출
        const { data: targets, error } = await supabase
            .from('master_places')
            .select('*') // 모든 컬럼을 가져와서 upsert 시 제약조건 위반 방지
            .eq('category', 'SPOT')
            .is('raw_data->areaCode', null)
            .limit(500);

        if (error) {
            console.error('❌ Fetch Error:', error.message);
            break;
        }

        if (!targets || targets.length === 0) {
            console.log('✅ All SPOT items already have KTO codes.');
            hasMore = false;
            break;
        }

        console.log(`- Found ${targets.length} items to process. Mapping codes...`);

        const batch = [];
        for (const item of targets) {
            const { areaCd, signguCd } = getAdminCodes(item.sido, item.sigungu);
            
            const newRawData = {
                ...item.raw_data,
                areaCode: areaCd || '0', 
                sigunguCode: signguCd || '0'
            };

            batch.push({
                ...item, // 기존 모든 컬럼 유지
                raw_data: newRawData
            });
        }

        if (batch.length > 0) {
            const { error: upsertErr } = await supabase.from('master_places').upsert(batch, { onConflict: 'id' });
            if (upsertErr) {
                console.error('❌ Batch Upsert Error:', upsertErr.message);
                // 에러 발생 시 단일 업데이트로 폴백 시도하지 않고 중단 (데이터 무결성 위해)
                break;
            } else {
                totalUpdated += batch.length;
                console.log(`✅ Batch successful. Total updated: ${totalUpdated}`);
            }
        }

        await new Promise(r => setTimeout(r, 200));
    }

    console.log(`\n🏁 KTO Backfill Completed. Total ${totalUpdated} items restored.`);
}

backfillKtoCodes().catch(console.error);
