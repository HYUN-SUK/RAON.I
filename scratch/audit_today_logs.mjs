// 오늘(4/15) 자동화 로그 정밀 조회 스크립트
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { config } from 'dotenv';

config({ path: resolve(process.cwd(), '.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
);

async function main() {
  console.log('=== RAONAI 자동화 로그 정밀 점검 (4/15 KST) ===\n');
  
  // KST 기준 오늘 새벽 = UTC 4/14 15:00 ~ 4/15 15:00
  const todayStartUTC = '2026-04-14T15:00:00Z';
  const todayEndUTC = '2026-04-15T15:00:00Z';
  
  // 1. 최근 20건 조회 (타입별)
  const { data: logs, error } = await supabase
    .from('automation_logs')
    .select('*')
    .gte('created_at', todayStartUTC)
    .lte('created_at', todayEndUTC)
    .order('created_at', { ascending: false });
  
  if (error) {
    console.error('DB 조회 실패:', error.message);
    return;
  }
  
  console.log(`📊 조회된 로그 총 건수: ${logs.length}건\n`);
  
  // 작업별로 분류
  const byJob = {};
  for (const log of logs) {
    if (!byJob[log.job_name]) byJob[log.job_name] = [];
    byJob[log.job_name].push(log);
  }
  
  for (const [jobName, jobLogs] of Object.entries(byJob)) {
    console.log(`\n${'='.repeat(60)}`);
    console.log(`🔹 작업명: ${jobName} (${jobLogs.length}건)`);
    console.log(`${'='.repeat(60)}`);
    
    for (const log of jobLogs) {
      const kstTime = new Date(new Date(log.created_at).getTime() + 9 * 60 * 60 * 1000);
      console.log(`\n📅 시각: ${kstTime.toISOString().replace('T', ' ').substring(0, 19)} KST`);
      console.log(`   상태: ${log.status}`);
      console.log(`   처리 건수: ${log.processed_count}`);
      console.log(`   소요 시간: ${log.duration_ms}ms`);
      console.log(`   타겟 일자: ${log.target_date || 'N/A'}`);
      
      // message 파싱
      if (log.message) {
        let msgText = log.message;
        let msgObj = null;
        if (typeof log.message === 'string' && log.message.startsWith('{')) {
          try {
            msgObj = JSON.parse(log.message);
            msgText = msgObj.text || log.message;
          } catch(e) {}
        } else if (typeof log.message === 'object') {
          msgObj = log.message;
          msgText = msgObj.text || JSON.stringify(msgObj).substring(0, 200);
        }
        console.log(`   메시지: ${msgText}`);
        
        // quota_flow 출력 (캐싱 2부)
        if (msgObj && msgObj.quota_flow) {
          console.log(`\n   📋 [2부] 단계별 정제 및 검증 지표 (Quota & Verification):`);
          console.log(`   ${'카테고리'.padEnd(16)} | ${'1번쿼터(Raw)'.padStart(12)} | ${'2번쿼터(Top)'.padStart(12)} | ${'검증완료'.padStart(8)} | ${'최종적재'.padStart(8)}`);
          console.log(`   ${'-'.repeat(70)}`);
          for (const q of msgObj.quota_flow) {
            console.log(`   ${(q.category||'').padEnd(16)} | ${String(q.raw_query||0).padStart(12)} | ${String(q.top_quota||0).padStart(12)} | ${String(q.verified||0).padStart(8)} | ${String(q.final||0).padStart(8)}`);
          }
        }
      }
      
      // api_status 출력 (1부: API별 지표 대조)
      if (log.api_status && Array.isArray(log.api_status) && log.api_status.length > 0) {
        console.log(`\n   📋 [1부] API별 지표 대조:`);
        
        if (jobName === 'DAILY_REGION_SYNC') {
          console.log(`   ${'지역'.padEnd(10)} | ${'카테고리'.padEnd(30)} | ${'기존'.padStart(8)} | ${'수신'.padStart(8)} | ${'신규'.padStart(8)} | ${'갱신'.padStart(8)} | ${'총계'.padStart(8)}`);
          console.log(`   ${'-'.repeat(100)}`);
          for (const s of log.api_status) {
            const existing = typeof s.existing_count === 'object' 
              ? `🟢${s.existing_count.active||0}/🔴${s.existing_count.inactive||0}` 
              : String(s.existing_count||0);
            const fetched = typeof s.fetched_count === 'object'
              ? `🟢${s.fetched_count.active||0}/🔴${s.fetched_count.inactive||0}`
              : String(s.fetched_count||0);
            const newC = typeof s.new_count === 'object'
              ? `🟢${s.new_count.active||0}/🔴${s.new_count.inactive||0}`
              : String(s.new_count||0);
            const updated = typeof s.updated_count === 'object'
              ? `🟢${s.updated_count.active||0}/🔴${s.updated_count.inactive||0}`
              : String(s.updated_count||0);
            const total = typeof s.total_count === 'object'
              ? `🟢${s.total_count.active||0}/🔴${s.total_count.inactive||0}`
              : String(s.total_count||0);
            
            console.log(`   ${(s.region||'').padEnd(10)} | ${(s.label||s.name||'').padEnd(30)} | ${existing.padStart(8)} | ${fetched.padStart(8)} | ${newC.padStart(8)} | ${updated.padStart(8)} | ${total.padStart(8)}`);
          }
        } else if (jobName === 'SMART_PLAN_CACHING') {
          console.log(`   ${'카테고리'.padEnd(16)} | ${'기존'.padStart(8)} | ${'수신'.padStart(8)} | ${'신규'.padStart(8)} | ${'갱신'.padStart(8)} | ${'총계'.padStart(8)}`);
          console.log(`   ${'-'.repeat(75)}`);
          for (const s of log.api_status) {
            console.log(`   ${(s.category||s.name||'').padEnd(16)} | ${String(s.existing||0).padStart(8)} | ${String(s.received||0).padStart(8)} | ${String(s.new||0).padStart(8)} | ${String(s.updated||0).padStart(8)} | ${String(s.total||0).padStart(8)}`);
          }
        } else {
          // 기타 작업
          for (const s of log.api_status) {
            console.log(`   - ${s.name || s.label}: 상태=${s.status}, 소요=${s.duration_ms}ms`);
          }
        }
      }
    }
  }
  
  // smart_plan_facts 현황
  console.log(`\n\n${'='.repeat(60)}`);
  console.log(`🔍 smart_plan_facts 테이블 현황`);
  console.log(`${'='.repeat(60)}`);
  
  const { data: factStats, error: factErr } = await supabase
    .from('smart_plan_facts')
    .select('category', { count: 'exact', head: false });
  
  if (!factErr && factStats) {
    const catCounts = {};
    for (const f of factStats) {
      catCounts[f.category] = (catCounts[f.category] || 0) + 1;
    }
    console.log(`총 팩트 수: ${factStats.length}건`);
    for (const [cat, cnt] of Object.entries(catCounts).sort()) {
      console.log(`  - ${cat}: ${cnt}건`);
    }
  }
  
  console.log('\n✅ 점검 완료');
}

main().catch(console.error);
