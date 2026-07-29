import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.RAON_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey);

async function checkTables() {
  console.log('Checking actual existing DB tables...');

  // Check schedules
  const { data: sched, error: schedErr } = await supabase.from('schedules').select('*').limit(5);
  console.log('Schedules Err:', schedErr?.message, 'Count:', sched?.length);

  // Check profiles count & date range
  const { data: profs, error: profErr } = await supabase.from('profiles').select('created_at, nickname').order('created_at', { ascending: false }).limit(35);
  console.log('Profiles Err:', profErr?.message, 'Recent 35 profiles created_at:');
  console.log(profs?.map(p => ({ date: p.created_at, name: p.nickname })));

  // Check reservations count & date range
  const { data: res, error: resErr } = await supabase.from('reservations').select('created_at, check_in_date, guest_name').order('created_at', { ascending: false }).limit(10);
  console.log('Reservations Recent 10:', res);
}

checkTables();
