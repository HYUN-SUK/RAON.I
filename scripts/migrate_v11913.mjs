import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function migrate() {
  const sqlPath = path.join(process.cwd(), 'scripts', 'setup_v11913.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');

  console.log('🚀 Phase 1: DB Migration Starting...');
  
  // SQL을 문장 단위로 분할하여 실행 (세미콜론 기준, 단 루틴 내부 세미콜론 주의)
  // 여기서는 간단하게 debug_execute_sql이 전체 블록을 받을 수 있다고 가정하거나, 
  // 함수 정의와 UPDATE문을 분리하여 처리합니다.
  
  const parts = sql.split('-- 2. 신뢰점수 정상화 (SOP v11.3 규격 준종)');
  const functionSql = parts[0];
  const updateSql = parts[1];

  console.log('- Deploying RPC function...');
  const { error: fError } = await supabase.rpc('exec_sql', { sql_query: functionSql });
  if (fError) {
    console.error('❌ RPC Deployment Failed:', fError);
    return;
  }

  console.log('- Normalizing trust scores...');
  const { error: uError } = await supabase.rpc('exec_sql', { sql_query: updateSql });
  if (uError) {
    console.error('❌ Score Normalization Failed:', uError);
  } else {
    console.log('✅ Phase 1 Complete: DB is now aligned with v11.9.13 manual.');
  }
}

migrate();
