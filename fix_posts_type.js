
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixPostsType() {
    try {
        console.log("Checking for invalid 'type' values in 'posts' table...");

        // Allowed types
        const allowedTypes = ['story', 'notice', 'review', 'qna', 'group_story'];

        // Fetch all distinct types currently in the table
        // Since we can't do "select distinct" easily with supabase-js plain query without rpc,
        // we'll fetch all posts (assuming not too many for this dev env) or use a filter.
        // Better: Fetch rows where type is NOT in allowed list.

        const { data: invalidRows, error } = await supabase
            .from('posts')
            .select('id, type')
            .not('type', 'in', `(${allowedTypes.join(',')})`); // Syntax might be tricky for 'in' with array-like string

        // Actually, supabase-js .not('type', 'in', allowedTypes) works?
        // Let's try to just fetch all and filter in memory to be safe and see what weird values exist.

        let output = "";

        console.log("Checking for invalid 'type' values...");
        output += "Checking for invalid 'type' values...\n";

        const { data: allPosts, error: fetchError } = await supabase
            .from('posts')
            .select('id, type');

        if (fetchError) {
            output += `Error fetching posts: ${fetchError.message}\n`;
            console.error(fetchError);
        } else {
            const invalidItems = allPosts.filter(p => !allowedTypes.includes(p.type));

            output += `Found ${invalidItems.length} invalid rows out of ${allPosts.length} total.\n`;

            if (invalidItems.length === 0) {
                output += "No invalid rows found. Migration should have passed? Maybe nulls?\n";
                // Check for nulls?
                // The constraint `CHECK (type IN ...)` implies NULL might be allowed unless NOT NULL is set.
                // But usually string types are NOT NULL in these designs.
            } else {
                const uniqueInvalid = [...new Set(invalidItems.map(p => p.type))];
                output += `Invalid Types Found: ${uniqueInvalid.join(', ')}\n`;

                for (const item of invalidItems) {
                    output += `Fixing post ${item.id} (type: ${item.type}) -> 'story'\n`;
                    const { error: updateError } = await supabase
                        .from('posts')
                        .update({ type: 'story' })
                        .eq('id', item.id);

                    if (updateError) {
                        output += `Failed to update post ${item.id}: ${updateError.message} (Code: ${updateError.code})\n`;
                        output += `Details: ${JSON.stringify(updateError)}\n`;
                    } else {
                        output += `Success.\n`;
                    }
                }
            }
        }

        fs.writeFileSync('fix_posts_log.txt', output, 'utf8');
        console.log("Log saved to fix_posts_log.txt");

    } catch (e) {
        console.error("Script error:", e);
    }
}

fixPostsType();
