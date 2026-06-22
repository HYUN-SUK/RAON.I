import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function run() {
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    console.error("Missing Supabase credentials");
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

  console.log("=== SQL RPC 기반 마스터 DB 적재 검산 ===");

  // 1. 카테고리별 적재 수량 검산 SQL
  const statsQuery = `
    SELECT 
        category,
        COUNT(*) as total_count,
        COUNT(CASE WHEN (raw_data->>'enriched')::boolean = true THEN 1 END) as enriched_count,
        COUNT(CASE WHEN updated_at >= '2026-06-17T18:11:00+00:00'::timestamptz THEN 1 END) as updated_since_yesterday_count
    FROM master_places
    WHERE is_active = true AND category IN ('RESTAURANT', 'ROUTE_CAFE', 'MART')
    GROUP BY category;
  `;

  const { data: statsData, error: err1 } = await supabase.rpc('exec_sql', { sql_query: statsQuery });
  if (err1) {
    console.error("Stats Query Error:", err1.message);
  } else {
    console.log("\n[1] 적재 통계 및 검산 (SQL 결과):");
    console.table(statsData);
  }

  // 2. 테이블 트리거 목록 확인 SQL
  const triggerQuery = `
    SELECT trigger_name, event_manipulation, action_statement, action_timing
    FROM information_schema.triggers
    WHERE event_object_table = 'master_places';
  `;

  const { data: triggerData, error: err2 } = await supabase.rpc('exec_sql', { sql_query: triggerQuery });
  if (err2) {
    console.error("Trigger Query Error:", err2.message);
  } else {
    console.log("\n[2] master_places 테이블 트리거 목록:");
    console.table(triggerData);
  }

  process.exit(0);
}

run();
