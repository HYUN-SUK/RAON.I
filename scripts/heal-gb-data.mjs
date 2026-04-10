import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function healData() {
  console.log('🩹 [Healing] Starting Data Cleaning for 경상북도...');

  // 1. 오늘 시뮬레이션 중 중복 생성된 데이터 삭제 (Full Name 접두어 기반)
  console.log('   - 🗑️ Removing duplicates created today...');
  const { data: dups, error: err1 } = await supabase
    .from('master_places')
    .delete()
    .in('sido', ['경상북도', '경북'])
    .gt('created_at', '2026-04-10T00:00:00Z')
    .eq('miss_count', 0); // 신규로 들어온 것만 삭제

  if (err1) console.error('  ❌ Delete Error:', err1.message);
  else console.log(`  ✅ Successfully removed potential duplicates.`);

  // 2. 3-Strike로 오판되어 비활성화된 기존 정합 데이터 부활
  console.log('   - ♻️ Resurrecting legacy records hit by 3-strike today...');
  const { data: resurrected, error: err2 } = await supabase
    .from('master_places')
    .update({ is_active: true, miss_count: 0, updated_at: new Date().toISOString() })
    .in('sido', ['경상북도', '경북'])
    .eq('is_active', false)
    .gte('miss_count', 3)
    .gt('updated_at', '2026-04-10T08:00:00Z'); // 오늘 오후(UTC 8시) 이후 업데이트된 것만

  if (err2) console.error('  ❌ Resurrection Error:', err2.message);
  else console.log(`  ✅ Successfully resurrected legacy records.`);

  console.log('✨ [Healing] Cleanup complete. Ready for clean sync simulation!');
}

healData();
