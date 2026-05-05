import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function checkGeminiLogs() {
    console.log('Checking latest API Health Check logs...');
    const { data, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'API_HEALTH_CHECK')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching logs:', error);
        return;
    }

    if (!data || data.length === 0) {
        console.log('No health check logs found.');
        return;
    }

    data.forEach((log, i) => {
        console.log(`\n--- Log ${i + 1} (${log.created_at}) ---`);
        const geminiStatus = log.api_status?.find((s: any) => s.name === 'GEMINI');
        if (geminiStatus) {
            console.log(`GEMINI Status: ${geminiStatus.status}`);
            console.log(`Error: ${geminiStatus.error || 'None'}`);
            console.log(`Duration: ${geminiStatus.duration_ms}ms`);
        } else {
            console.log('GEMINI status not found in this log.');
        }
    });
}

checkGeminiLogs();
