
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function probe() {
  console.log('--- Probing Database Tables for Plans ---');
  // 1. List all tables
  const { data: tables } = await supabase.from('automation_logs').select('job_name').limit(1); // dummy just to see if we can talk to DB
  
  // Actually let's just query the schema via raw SQL if possible, or common table names
  const potentialTables = ['smart_plan_facts', 'smart_plan_logs', 'user_schedules', 'user_schedule_plans'];
  
  for (const table of potentialTables) {
    const { data, error } = await supabase.from(table).select('*').limit(1);
    if (!error) {
      console.log(`Table '${table}' exists. Columns:`, Object.keys(data[0] || {}).join(', '));
      // Check if it has target_date
      const { count } = await supabase.from(table).select('*', { count: 'exact', head: true }).filter('created_at', 'gte', '2026-03-27T00:00:00Z');
      console.log(`  Recent records (since 3/27): ${count || 0}`);
    }
  }
}
probe();
