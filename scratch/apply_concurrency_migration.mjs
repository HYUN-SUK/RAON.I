import pg from 'pg';
import fs from 'fs';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL || process.env.SUPABASE_DB_URL;

async function applyMigration() {
  console.log('=== [Strict Reservation Concurrency 마이그레이션 적용] ===\n');

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

    const sql = fs.readFileSync('supabase/migrations/20260819000000_strict_reservation_concurrency.sql', 'utf8');
    
    console.log('⚡ SQL 실행 중...');
    await client.query(sql);
    console.log('🎉 마이그레이션 성공적으로 적용 완료!');
  } catch (err) {
    console.error('❌ 마이그레이션 적용 실패:', err);
  } finally {
    await client.end();
  }
}

applyMigration();
