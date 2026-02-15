
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function debugQuery() {
    try {
        // Imitate Edge Function Date Logic
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstDate = new Date(now.getTime() + kstOffset);
        const today = kstDate.toISOString().split('T')[0];

        const tomorrowDate = new Date(kstDate);
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toISOString().split('T')[0];

        const d4Date = new Date(kstDate);
        d4Date.setDate(d4Date.getDate() + 4);
        const d4 = d4Date.toISOString().split('T')[0];

        let output = `Querying for: [${today}, ${tomorrow}, ${d4}]\n`;

        const { data, error } = await supabase
            .from('user_schedules')
            .select('id, user_id, campground_name, check_in, status')
            .in('status', ['scheduled'])
            .in('check_in', [today, tomorrow, d4]);

        if (error) {
            console.error(error);
            return;
        }

        output += `Found ${data.length} schedules.\n`;
        data.forEach(s => {
            output += `- ${s.campground_name} (${s.check_in})\n`;
        });

        fs.writeFileSync('debug_query_log.txt', output, 'utf8');
        console.log("Log saved to debug_query_log.txt");

    } catch (e) {
        console.error(e);
    }
}

debugQuery();
