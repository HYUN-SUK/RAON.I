
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyNotifications() {
    try {
        console.log("Checking notifications...");
        const { data, error } = await supabase
            .from('notifications')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(20);

        if (error) { console.error(error); return; }

        let output = `Found ${data.length} recent notifications:\n\n`;
        data.forEach(n => {
            output += `[TITLE]: ${n.title}\n`;
            output += `[BODY]: ${n.body}\n`;
            output += "---------------------------------------------------\n";
        });

        fs.writeFileSync('notification_log.txt', output, 'utf8');
        console.log("Log saved to notification_log.txt");
    } catch (e) {
        console.error(e);
    }
}

verifyNotifications();
