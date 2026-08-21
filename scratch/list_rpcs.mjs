import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function listRpcs() {
  // Test some common RPC names
  const rpcNames = [
    'create_reservation_safe',
    'get_public_reservations',
    'get_my_reservations',
    'execute_sql',
    'exec',
    'query',
    'run_query'
  ];

  for (const name of rpcNames) {
    const { error } = await supabase.rpc(name, {});
    console.log(`RPC [${name}]:`, error ? error.message : 'EXISTS');
  }
}

listRpcs();
