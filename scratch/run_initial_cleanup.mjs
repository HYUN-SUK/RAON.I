import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function runInitialDBCleanup() {
    console.log('🚀 Executing Initial DB Auto-Purge & Slimming for smart_plan_candidates...\n');

    // 1. Get initial total count
    const { count: beforeCount } = await supabase
        .from('smart_plan_candidates')
        .select('*', { count: 'exact', head: true });

    console.log(`Initial total rows in smart_plan_candidates: ${beforeCount}`);

    // 2. Compute 7 days ago threshold
    const d = new Date();
    d.setDate(d.getDate() - 7);
    const sevenDaysAgoStr = d.toISOString().split('T')[0];
    console.log(`Cut-off date (check_out < 7 days ago): ${sevenDaysAgoStr}`);

    // 3. Find cancelled or old expired schedules
    const { data: expiredSchedules } = await supabase
        .from('user_schedules')
        .select('id, campground_name, status, check_out')
        .or(`status.eq.cancelled,check_out.lt.${sevenDaysAgoStr}`);

    console.log(`Found ${expiredSchedules?.length || 0} cancelled/expired schedules.`);
    expiredSchedules?.forEach(s => {
        console.log(`   - [${s.status}] ${s.campground_name} (${s.id}) | CheckOut: ${s.check_out}`);
    });

    const expiredIds = (expiredSchedules || []).map(s => s.id);

    if (expiredIds.length > 0) {
        console.log(`\nPurging candidates for ${expiredIds.length} expired schedules...`);
        const { error, count } = await supabase
            .from('smart_plan_candidates')
            .delete()
            .in('reservation_id', expiredIds);

        if (error) {
            console.error('Delete Error:', error);
        } else {
            console.log(`✅ Successfully purged candidate rows for ${expiredIds.length} schedules!`);
        }
    }

    // 4. Verify count after cleanup
    const { count: afterCount } = await supabase
        .from('smart_plan_candidates')
        .select('*', { count: 'exact', head: true });

    console.log(`\n====================================================`);
    console.log(`BEFORE Cleanup: ${beforeCount} rows`);
    console.log(`AFTER Cleanup:  ${afterCount} rows`);
    console.log(`SLIMMED BY:    ${(beforeCount || 0) - (afterCount || 0)} rows (Purged!)`);
    console.log(`====================================================\n`);
}

runInitialDBCleanup();
