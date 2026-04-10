import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function healDataV2() {
  console.log('🩹 [Healing v2] Cleaning up Short-Name ID mess and resurrecting Full-Name IDs...');

  // 1. 오늘 생성된 잘못된 ID 레코드들 삭제 (경찰관 출동)
  // [CRITICAL] 4/10 17:00 KST (08:00 UTC) 이후 생성된 것 중 경상북도 데이터
  const { data: killed, error: err1 } = await supabase
    .from('master_places')
    .delete()
    .in('sido', ['경상북도', '경북'])
    .gt('created_at', '2026-04-10T08:00:00Z');

  if (err1) console.error('  ❌ Delete Error:', err1.message);
  else console.log(`  ✅ Successfully purged today's duplicate records.`);

  // 2. 억울하게 죽은(비활성화된) 구형 레코드들 부활
  const { data: backToLife, error: err2 } = await supabase
    .from('master_places')
    .update({ is_active: true, miss_count: 0, updated_at: new Date().toISOString() })
    .in('sido', ['경상북도', '경북'])
    .eq('is_active', false)
    .gt('updated_at', '2026-04-10T08:00:00Z');

  if (err2) console.error('  ❌ Resurrection Error:', err2.message);
  else console.log(`  ✅ Successfully resurrected legacy records.`);

  console.log('✨ [Healing v2] Environment is clean. Ready for stable ID sync!');
}

healDataV2();
