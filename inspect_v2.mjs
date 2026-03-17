
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase.from('user_schedules').select('*').limit(1);
  if (data && data.length > 0) {
    fs.writeFileSync('user_schedules_columns.json', JSON.stringify(Object.keys(data[0]), null, 2));
  } else {
    fs.writeFileSync('user_schedules_columns.json', JSON.stringify({ error: 'No data' }, null, 2));
  }
}
inspect();
