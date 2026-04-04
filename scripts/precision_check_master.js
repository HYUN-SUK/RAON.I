const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
const path = require('path');

// Load env from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkSyncStatus() {
    console.log('--- Real-time Master DB Progress Panel ---');
    
    // 1. Snapshot counts by Category
    const categories = ['SPOT', 'RESTAURANT', 'MART'];
    for (const cat of categories) {
        try {
            const { count, error } = await supabase
                .from('master_places')
                .select('*', { count: 'exact', head: true })
                .eq('category', cat);
            if (error) console.error(`Error fetching ${cat}:`, error.message);
            else console.log(`${cat}: ${count} items`);
        } catch (e) {
            console.error(`Exception checking ${cat}:`, e.message);
        }
    }

    try {
        const { count: total } = await supabase.from('master_places').select('*', { count: 'exact', head: true });
        console.log(`\nGRAND TOTAL: ${total} items`);
    } catch (e) {
        console.error('Exception checking total:', e.message);
    }

    // 2. Latest Sync Log
    try {
        const { data: logs, error: logError } = await supabase
            .from('automation_logs')
            .select('*')
            .eq('job_name', 'MASTER_SYNC')
            .order('created_at', { ascending: false })
            .limit(1);

        if (logError) {
            console.error('Error fetching logs:', logError.message);
        } else if (logs && logs.length > 0) {
            process.stdout.write(`\nLatest Sync Log [${logs[0].status}] - ${logs[0].message} (Created At: ${logs[0].created_at})\n`);
        }
    } catch (e) {
        console.error('Exception checking logs:', e.message);
    }
}

checkSyncStatus().then(() => {
    // Force exit to ensure all output is flushed
    process.exit(0);
}).catch(err => {
    console.error(err);
    process.exit(1);
});
