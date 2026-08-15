import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function inspectCandidatesLifecycle() {
    console.log('🔍 Inspecting Lifecycle & Cleanup of smart_plan_candidates...\n');

    // 1. Check total rows in smart_plan_candidates
    const { count: totalCandidatesCount } = await supabase
        .from('smart_plan_candidates')
        .select('*', { count: 'exact', head: true });

    console.log(`1. Total rows in smart_plan_candidates DB: ${totalCandidatesCount} rows.`);

    // 2. Check reservation_id count & candidate count per reservation
    const { data: candidatesSample } = await supabase
        .from('smart_plan_candidates')
        .select('reservation_id');

    const resCounts = new Map();
    candidatesSample?.forEach(c => {
        resCounts.set(c.reservation_id, (resCounts.get(c.reservation_id) || 0) + 1);
    });

    console.log(`2. Total unique reservation_ids with cached candidates: ${resCounts.size}`);
    console.log('   Candidate rows per reservation distribution:');
    resCounts.forEach((cnt, resId) => {
        console.log(`   - Reservation ID ${resId}: ${cnt} candidates`);
    });

    // 3. Check corresponding schedules status (CHECKED_OUT, CANCELLED, ACTIVE)
    const resIds = Array.from(resCounts.keys());
    const { data: schedules } = await supabase
        .from('user_schedules')
        .select('id, campground_name, status, check_in, check_out, created_at')
        .in('id', resIds);

    console.log('\n3. Schedules Status for Cached Candidates:');
    schedules?.forEach(s => {
        console.log(`   - [${s.status}] ${s.campground_name} (${s.id}) | CheckIn: ${s.check_in} ~ CheckOut: ${s.check_out}`);
    });
}

inspectCandidatesLifecycle();
