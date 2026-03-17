
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspect() {
  const { data, error } = await supabase.from('user_schedules').select('*').limit(1);
  if (data && data.length > 0) {
    console.log('Columns in user_schedules:', Object.keys(data[0]));
  } else {
    // If no data, try to get from another table or just check if table exists
    console.log('No data in user_schedules to inspect columns.');
  }
}
inspect();
