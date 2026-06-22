import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing credentials.");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

async function createIndex() {
  const sql = `CREATE INDEX IF NOT EXISTS idx_master_places_updated_at ON public.master_places(updated_at);`;
  console.log("Attempting to create index via exec_sql or run_sql RPC...");

  // Try exec_sql first
  try {
    const { data, error } = await supabase.rpc('exec_sql', { sql });
    if (!error) {
      console.log("Index created successfully via exec_sql!");
      process.exit(0);
    }
    console.warn("exec_sql failed, trying run_sql...", error.message);
  } catch (e) {
    console.warn("exec_sql exception, trying run_sql...", e.message);
  }

  // Try run_sql next
  try {
    const { data, error } = await supabase.rpc('run_sql', { sql });
    if (!error) {
      console.log("Index created successfully via run_sql!");
      process.exit(0);
    }
    console.error("run_sql failed:", error.message);
  } catch (e) {
    console.error("run_sql exception:", e.message);
  }

  console.error("Failed to create index via both RPC methods. Manual execution may be required.");
  process.exit(1);
}

createIndex();
