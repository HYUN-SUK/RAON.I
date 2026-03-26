const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function checkMartStats() {
    const sources = ['LARGE', 'SSM', 'SUPER'];
    const results = {};
    
    console.log('--- 🛒 MART DATA AUDIT REPORT (Master DB) ---');
    
    const fs = require('fs');
    let output = '--- 🛒 MART DATA AUDIT REPORT (Master DB) ---\n';
    
    for (const s of sources) {
        const { count, error } = await supabase
            .from('master_places')
            .select('*', { count: 'exact', head: true })
            .ilike('api_source', `%${s}%`);
        
        if (error) {
            console.error(`Error fetching ${s}:`, error);
        } else {
            results[s] = count;
            output += `${s}: ${count?.toLocaleString()} 건\n`;
        }
    }
    
    // Check automation_logs for the most recent MASTER_SYNC
    const { data: logData, error: logError } = await supabase
        .from('automation_logs')
        .select('*')
        .eq('job_name', 'MASTER_SYNC')
        .order('created_at', { ascending: false })
        .limit(1);
    
    if (logError) {
        console.error('Error fetching logs:', logError);
    } else if (logData && logData.length > 0) {
        const log = logData[0];
        output += '\n--- 🕒 LATEST SYNC LOG ---\n';
        output += `Sync Time: ${log.created_at}\n`;
        output += `Status: ${log.status}\n`;
        output += `Total Processed: ${log.processed_count}\n`;
        output += `Message: ${log.message}\n`;
        
        if (log.api_status) {
            output += '\n--- 📂 API BREAKDOWN FROM LOG ---\n';
            log.api_status.forEach(s => {
                if (s.name.includes('MART')) {
                    output += `- ${s.label}: Fetched=${s.fetched_count}, New=${s.new_count}, Updated=${s.updated_count}\n`;
                }
            });
        }
    } else {
        output += '\n[!] MASTER_SYNC 로그 기록을 찾을 수 없습니다.\n';
    }

    // Also find ALL unique api_sources to see what we actually have
    const { data: allSources, error: sourceErr } = await supabase
        .from('master_places')
        .select('api_source');
    
    if (!sourceErr && allSources) {
        const uniqueSources = new Set();
        allSources.forEach(r => {
            if (r.api_source) {
                r.api_source.split(',').forEach(s => uniqueSources.add(s.trim()));
            }
        });
        output += '\n--- 🔍 ALL UNIQUE SOURCES IN DB ---\n';
        Array.from(uniqueSources).sort().forEach(s => output += `- ${s}\n`);
    }

    fs.writeFileSync('c:\\Users\\USER\\Desktop\\RAON.I\\tmp\\mart_stats_utf8.txt', output, 'utf8');
    console.log('Report saved to tmp/mart_stats_utf8.txt');
}

checkMartStats();
