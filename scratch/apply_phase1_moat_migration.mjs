import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

async function applyMigration() {
  console.log('=== [A+D 해자 데이터 수집 체계 Phase 1 마이그레이션 적용] ===\n');

  if (!connectionString) {
    console.error('❌ DATABASE_URL missing in .env.local');
    process.exit(1);
  }

  const client = new pg.Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('✅ PostgreSQL DB 연결 성공');

    const sql = fs.readFileSync('supabase/migrations/20260822_moat_data_phase1.sql', 'utf8');
    
    console.log('⚡ SQL 실행 중...');
    await client.query(sql);
    console.log('🎉 Phase 1 마이그레이션 성공적으로 적용 완료!\n');

    // 테이블 및 뷰 검증
    const res = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
        AND table_name IN ('partners', 'nav_intent_log', 'plan_swap_log', 'place_verifications', 'plan_snapshot', 'tuning_log', 'v_moat_metrics');
    `);
    console.log('📋 생성/확인된 테이블 및 뷰 목록:');
    res.rows.forEach(r => console.log(`  - ${r.table_name}`));

    // partners 시드 데이터 확인
    const partnerRes = await client.query('SELECT id, name, slug, status FROM public.partners;');
    console.log('\n🏢 partners 기본 테넌트 데이터:', partnerRes.rows);

  } catch (err) {
    console.error('❌ 마이그레이션 적용 실패:', err);
  } finally {
    await client.end();
  }
}

applyMigration();
