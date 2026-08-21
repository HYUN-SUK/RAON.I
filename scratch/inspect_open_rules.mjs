import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function checkOpenDayRulesDetailed() {
  const { data: rules, error } = await supabase
    .from('open_day_rules')
    .select('*');

  console.log('=== open_day_rules 상세 내용 ===');
  console.log(rules);

  const { data: sites } = await supabase
    .from('sites')
    .select('*');
  console.log('=== sites 목록 ===');
  console.log(sites?.map(s => ({ id: s.id, name: s.name, isActive: s.is_active, siteType: s.site_type })));
}

checkOpenDayRulesDetailed();
