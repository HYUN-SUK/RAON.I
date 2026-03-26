const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
require('dotenv').config({ path: '.env.local' });

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function listAllSources() {
    const { data, error } = await supabase
        .from('master_places')
        .select('api_source')
        .eq('category', 'MART');
    
    if (!error && data) {
        const counts = {};
        data.forEach(r => {
            const s = r.api_source || 'NULL';
            counts[s] = (counts[s] || 0) + 1;
        });
        
        let report = '--- FULL MART SOURCE COUNTS ---\n';
        Object.entries(counts).forEach(([s, c]) => {
            report += `${s}: ${c}\n`;
        });
        fs.writeFileSync('c:\\Users\\USER\\Desktop\\RAON.I\\tmp\\full_mart_sources.txt', report, 'utf8');
        console.log('Report saved to tmp/full_mart_sources.txt');
    } else {
        console.error('Error fetching data:', error);
    }
}

listAllSources();
