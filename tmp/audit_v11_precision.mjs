
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runAudit() {
  const targetDate = '2026-03-31';
  console.log(`--- Audit for Target Date: ${targetDate} ---`);

  // 1. Find reservations for target date
  const { data: reservations, error: resError } = await supabase
    .from('user_schedules')
    .select('*, site_config(*)')
    .eq('check_in', targetDate);

  if (resError) throw resError;
  console.log(`Found ${reservations?.length || 0} reservations for ${targetDate}`);

  // 2. Get the latest automation log for SMART_PLAN_CACHING
  const { data: logs, error: logError } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('job_name', 'SMART_PLAN_CACHING')
    .order('created_at', { ascending: false })
    .limit(5);

  if (logError) throw logError;
  console.log('\n--- Latest Automation Logs ---');
  logs.forEach(log => {
    console.log(`ID: ${log.id} | Date: ${log.created_at} | Target: ${log.target_date} | Status: ${log.status}`);
    // console.log(`Message: ${log.message}`);
  });

  // 3. For the most relevant log, parse the message
  const relevantLog = logs.find(l => l.target_date === targetDate) || logs[0];
  if (relevantLog) {
    console.log(`\nAnalyzing Log ID: ${relevantLog.id}`);
    const msg = JSON.parse(relevantLog.message);
    console.log('Breakdown from Log:');
    console.log(JSON.stringify(msg, null, 2));
  }

  // 4. Query final counts from smart_plan_facts
  const { data: facts, error: factError } = await supabase
    .from('smart_plan_facts')
    .select('category, name, trust_score, address, id, metadata')
    .eq('target_date', targetDate);

  if (factError) throw factError;
  
  const categoryCounts = facts.reduce((acc, curr) => {
    acc[curr.category] = (acc[curr.category] || 0) + 1;
    return acc;
  }, {});

  console.log('\n--- Final Fact Counts in DB ---');
  console.log(categoryCounts);

  // 5. Output detailed list
  console.log('\n--- Detailed List (First 5 of each) ---');
  const categories = [...new Set(facts.map(f => f.category))];
  categories.forEach(cat => {
    const catFacts = facts.filter(f => f.category === cat);
    console.log(`\n[${cat}] (${catFacts.length} total)`);
    catFacts.slice(0, 5).forEach(f => {
      console.log(`- ${f.name} (${f.trust_score}) | ${f.address}`);
    });
  });

  // Export to full list for the user's file request
  return { facts, relevantLog, targetDate };
}

runAudit().catch(console.error);
