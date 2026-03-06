
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const rawEnv = fs.readFileSync('.env.local', 'utf8');
const env = {};
rawEnv.split('\n').forEach(l => { 
  const p = l.split('='); 
  if(p.length>=2) env[p[0].trim()] = p.slice(1).join('=').trim(); 
});
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

(async () => {
  const { data: schedules } = await supabase.from('user_schedules').select('*').order('created_at', {ascending: false}).limit(5);
  const { data: notifs } = await supabase.from('notifications').select('*').order('created_at', {ascending: false}).limit(5);

  fs.writeFileSync('db_out.json', JSON.stringify({schedules, notifs}, null, 2));
})();
