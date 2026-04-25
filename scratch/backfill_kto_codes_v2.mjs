import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { getAdminCodes } from '../scripts/utils/admin-code-mapping.mjs';

dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function backfillKtoCodes() {
    console.log('🛠 Starting KTO Code Backfill (v12.2 - Update Mode)');

    let totalUpdated = 0;
    let hasMore = true;

    while (hasMore) {
        // 1. KTO 코드가 없는 SPOT 카테고리 500건씩 추출
        const { data: targets, error } = await supabase
            .from('master_places')
            .select('id, sido, sigungu, raw_data')
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

        console.log(`- Found ${targets.length} items to process...`);

        for (const item of targets) {
            const { areaCd, signguCd } = getAdminCodes(item.sido, item.sigungu);
            if (areaCd && signguCd) {
                const newRawData = {
                    ...item.raw_data,
                    areaCode: areaCd,
                    sigunguCode: signguCd
                };
                
                // upsert 대신 단일 update (제약 조건 회피)
                const { error: updErr } = await supabase
                    .from('master_places')
                    .update({ raw_data: newRawData })
                    .eq('id', item.id);
                
                if (!updErr) {
                    totalUpdated++;
                    if (totalUpdated % 100 === 0) process.stdout.write('.');
                } else {
                    console.error(`\n❌ Fail [${item.id}]:`, updErr.message);
                }
            } else {
                // 매칭 실패 시 최소한의 값이라도 넣어 다음 검색에서 제외되도록 함 (무한루프 방지)
                const failRaw = { ...item.raw_data, areaCode: '0', sigunguCode: '0' };
                await supabase.from('master_places').update({ raw_data: failRaw }).eq('id', item.id);
            }
        }
        console.log(`\n✨ Batch processed. Total updated so far: ${totalUpdated}`);
        
        // 너무 빠른 요청 방지
        await new Promise(r => setTimeout(r, 500));
    }

    console.log(`\n🏁 KTO Backfill Completed. Total ${totalUpdated} items restored.`);
}

backfillKtoCodes().catch(console.error);
