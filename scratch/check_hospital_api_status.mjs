import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkHospitalStatus() {
    console.log('Checking HOSPITAL api_status for Aug 4 and Aug 3 DAILY_REGION_SYNC logs...');
    
    const { data: logs, error } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'DAILY_REGION_SYNC')
        .order('created_at', { ascending: false })
        .limit(10);

    if (error) {
        console.error(error);
        return;
    }

    logs.forEach(l => {
        const utcDate = new Date(l.created_at);
        const kstDate = new Date(utcDate.getTime() + 9 * 60 * 60 * 1000);
        const kstStr = kstDate.toISOString().replace('T', ' ').slice(0, 19);

        console.log(`\n========================================`);
        console.log(`KST: ${kstStr} | Region Message: ${l.message}`);
        
        const apiStatusList = l.api_status || [];
        console.log(`Total API status items in this log: ${apiStatusList.length}`);
        
        const hospitalItem = apiStatusList.find(s => s.name === 'HOSPITAL' || s.label?.includes('HOSPITAL') || s.label?.includes('병원'));
        console.log(`HOSPITAL Item:`, JSON.stringify(hospitalItem, null, 2));
    });
}

checkHospitalStatus();
