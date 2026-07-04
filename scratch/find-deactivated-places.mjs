import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function run() {
  // 1. 가장 최근의 DAILY_CRAWL_ENRICHMENT 로그 조회
  const { data: logs, error } = await supabase
    .from('automation_logs')
    .select('id, job_name, status, api_status, created_at')
    .eq('job_name', 'DAILY_CRAWL_ENRICHMENT')
    .order('created_at', { ascending: false })
    .limit(1);

  if (error) {
    console.error("Error reading logs:", error);
    return;
  }

  if (!logs || logs.length === 0) {
    console.log("No crawler logs found.");
    return;
  }

  const log = logs[0];
  console.log(`[Log Date: ${log.created_at}] Status: ${log.status}`);
  
  const apiStatus = log.api_status;
  if (!apiStatus || !apiStatus.history) {
    console.log("No history in api_status:", JSON.stringify(apiStatus));
    return;
  }

  // 2. history 목록에서 FAILED, DEACTIVATED 등을 추려서
  // 3진 아웃(deactivatedCount가 있고 실제 is_active가 false로 업데이트된 매장)을 색출
  console.log("\n=== Checking History ===");
  const history = apiStatus.history || [];
  const deactivated = [];
  
  history.forEach(item => {
    if (item.status === 'DEACTIVATED' || item.status === 'FAILED') {
      console.log(`- Place: ${item.name} | Status: ${item.status} | Category: ${item.category}`);
    }
  });

  // 3. 실제 DB 상에서 최근 24시간 내에 is_active = false 로 변경된 장소 중,
  // 오늘 날짜에 매치되는 비활성 매장을 쿼리해 봅니다.
  const { data: places, error: pErr } = await supabase
    .from('master_places')
    .select('id, name, address, category, is_active, miss_count, updated_at')
    .eq('is_active', false)
    .gt('updated_at', '2026-07-01T20:00:00Z') // 어제 밤 9시(KST 오늘 오전 6시 이전) 이후 업데이트된 것
    .order('updated_at', { ascending: false });

  if (pErr) {
    console.error("Error query master_places:", pErr);
    return;
  }

  console.log("\n=== Deactivated master_places in last 24h ===");
  places.forEach(p => {
    console.log(`ID: ${p.id} | Name: ${p.name} | Category: ${p.category} | MissCount: ${p.miss_count} | UpdatedAt: ${p.updated_at}`);
  });
}
run();
