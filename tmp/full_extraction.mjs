
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runExtraction() {
  console.log('--- [Extraction Deep Dive] ---');

  // 1. Fetch the absolute latest log regardless of target_date string match
  const { data: logs, error: logError } = await supabase
    .from('automation_logs')
    .select('*')
    .eq('job_name', 'SMART_PLAN_CACHING')
    .order('created_at', { ascending: false })
    .limit(1);

  if (logError || !logs?.[0]) {
    console.error('No SMART_PLAN_CACHING logs found at all.');
    process.exit(1);
  }

  const log = logs[0];
  const targetDate = log.target_date;
  console.log(`Found Log ID: ${log.id}`);
  console.log(`Target Date from Log: '${targetDate}'`);
  console.log(`Created: ${log.created_at}`);

  const msg = JSON.parse(log.message);
  const tracking = msg.tracking || {};
  const stepB = tracking.stepB_filter || {};

  const categories = ['RESTAURANT', 'SPOT', 'MART', 'HOSPITAL', 'GAS_STATION', 'FESTIVAL'];
  const auditTable = [];

  for (const cat of categories) {
    // Master Total
    const { count: masterCount } = await supabase
      .from('master_places')
      .select('*', { count: 'exact', head: true })
      .eq('category', cat)
      .ilike('address', '%예산군%');

    // Final DB count
    const { count: finalCount } = await supabase
      .from('smart_plan_facts')
      .select('*', { count: 'exact', head: true })
      .eq('target_date', targetDate)
      .eq('category', cat);
    
    const discovered = stepB[cat]?.discovered || 0;
    const quotaPassed = stepB[cat]?.passed_formula || 0;
    const finalDB = finalCount || 0;
    const kakaoVerified = finalDB; 

    auditTable.push({
      category: cat,
      masterTotal: masterCount || 0,
      discovered,
      quotaPassed,
      kakaoVerified,
      finalDB
    });
  }

  // Fetch full list
  const { data: facts, error: factError } = await supabase
    .from('smart_plan_facts')
    .select('category, name, address, trust_score, description, api_source')
    .eq('target_date', targetDate)
    .order('category', { ascending: true })
    .order('trust_score', { ascending: false });

  if (factError) throw factError;

  const result = {
    targetDate,
    auditLog: { id: log.id, created: log.created_at, status: log.status },
    auditTable,
    facts
  };

  fs.writeFileSync('tmp/audit_result.json', JSON.stringify(result, null, 2));
  console.log(`Extraction complete for target_date: ${targetDate}. Saved to tmp/audit_result.json`);
}

runExtraction().catch(err => {
  console.error(err);
  process.exit(1);
});
