
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase URL or Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function updateTags() {
    try {
        const data = JSON.parse(fs.readFileSync('tags_mapping.json', 'utf8'));
        console.log(`Loaded ${data.length} items to update.`);

        let successCount = 0;
        let failCount = 0;

        for (const item of data) {
            const { id, tags } = item;

            const { error } = await supabase
                .from('recommendation_pool')
                .update({ tags: tags })
                .eq('id', id);

            if (error) {
                console.error(`Failed to update ID ${id}:`, error);
                failCount++;
            } else {
                successCount++;
                // stdout is buffered, so we might not see this immediately without flush, but it's fine
                if (successCount % 20 === 0) {
                    process.stdout.write('.');
                }
            }
        }

        console.log(`\nUpdate complete. Success: ${successCount}, Failed: ${failCount}`);
    } catch (err) {
        console.error("Error executing updates:", err);
    }
}

updateTags();
