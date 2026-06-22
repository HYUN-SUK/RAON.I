import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const s = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function main() {
  const oneDayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  console.log(`Checking DAILY_MASTER_ENRICHMENT logs since: ${oneDayAgo}`);
  
  const { data, error } = await s.from('automation_logs')
    .select('created_at, status, processed_count, message')
    .eq('job_name', 'DAILY_MASTER_ENRICHMENT')
    .gte('created_at', oneDayAgo)
    .order('created_at', { ascending: false });
    
  if (error) {
    console.error('Error fetching logs:', error.message);
    return;
  }
  
  if (!data || data.length === 0) {
    console.log('No DAILY_MASTER_ENRICHMENT logs found in the last 24 hours.');
    return;
  }
  
  let cronRuns = 0;
  let cronProcessed = 0;
  let bulkRuns = 0;
  let bulkProcessed = 0;
  
  console.log(`\n=== 개별 로그 샘플 (상위 5개) ===`);
  data.slice(0, 5).forEach((log, i) => {
    console.log(`[${i+1}] ${log.created_at} | Status: ${log.status} | Count: ${log.processed_count} | Msg: ${log.message}`);
  });

  for (const log of data) {
    if (log.status !== 'SUCCESS') continue;
    
    if (log.message && log.message.includes('분산 적재')) {
      cronRuns++;
      cronProcessed += log.processed_count;
    } else {
      bulkRuns++;
      bulkProcessed += log.processed_count;
    }
  }
  
  console.log(`\n=== 최근 24시간 내 DAILY_MASTER_ENRICHMENT 분류 통계 ===`);
  console.log(`1. 크론잡 분산 적재 (Gemini 한줄 요약 포함)`);
  console.log(`   - 성공 횟수: ${cronRuns} 회`);
  console.log(`   - 누적 처리 건수: ${cronProcessed} 건`);
  console.log(`2. 벌크 고속 적재 (Playwright/공공 API 대량 수집)`);
  console.log(`   - 성공 횟수: ${bulkRuns} 회`);
  console.log(`   - 누적 처리 건수: ${bulkProcessed} 건`);
  
  if (cronProcessed >= 1200) {
    console.log(`\n✅ 제미나이가 매일 1,200개 이상의 한줄 요약 분산 적재를 원활하게 수행하고 있습니다!`);
  } else {
    console.log(`\n⚠️ 제미나이의 크론 분산 적재량(${cronProcessed}건)이 일일 목표치 1,200건에 미달하고 있습니다.`);
    console.log(`(크론 스케줄 작동 상태 혹은 Vercel Cron 트리거 확인이 필요합니다.)`);
  }
}

main();
