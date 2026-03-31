import 'dotenv/config';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import dotenv from 'dotenv';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env.local
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
  dotenv.config({ path: envPath });
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Error: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is missing.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkLogs() {
  const { data, error } = await supabase
    .from('automation_logs')
    .select('*')
    .gte('created_at', '2026-03-29T00:00:00Z')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching logs:', error);
    return;
  }

  if (!data || data.length === 0) {
    console.log('No logs found for 2026-03-29.');
  } else {
    console.log(JSON.stringify(data, null, 2));
  }
}

checkLogs();
