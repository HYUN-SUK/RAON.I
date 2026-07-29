import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function getUser() {
  const { data } = await supabase.from('profiles').select('id').limit(1);
  console.log('Valid User ID:', data?.[0]?.id);
}

getUser();
