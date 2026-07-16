import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function run() {
  const { data, error } = await supabase.from('reservations').select('*').limit(1);
  if (error) {
    console.error(error);
  } else {
    console.log("Reservations Columns:", data.length > 0 ? Object.keys(data[0]) : "No rows");
    console.log("Sample Reservation:", data[0]);
  }
}
run();
