import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function testSqlRpc() {
  const sql = fs.readFileSync('supabase/migrations/20260819000000_strict_reservation_concurrency.sql', 'utf8');

  console.log('1. Trying exec_sql RPC...');
  const { data: d1, error: e1 } = await supabase.rpc('exec_sql', { sql });
  console.log('exec_sql result:', { d1, e1 });

  if (e1) {
    console.log('2. Trying run_sql RPC...');
    const { data: d2, error: e2 } = await supabase.rpc('run_sql', { sql });
    console.log('run_sql result:', { d2, e2 });
  }
}

testSqlRpc();
