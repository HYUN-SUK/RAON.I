
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

// NOTE: Using ANON key might have restriction on DELETE if RLS doesn't allow it.
// If this fails, we might need SERVICE_ROLE_KEY but usually that's not in .env.local for client app.
// However, the instructions imply we are in a dev environment where we might have relaxed RLS or we should try.
// If anon fails, we'll need to user the dashboard or ask user, but let's try anon first as sometimes 'public' or 'anon' can delete own posts or RLS is off dev.
// Actually, RLS usually blocks delete for anon.
// Let's assume for now we might have a service key in .env or the user has set RLS to allow all efficiently (handoff mentioned RLS update).

const supabase = createClient(supabaseUrl, supabaseKey);

async function cleanStoryPosts() {
    console.log('🧹 Cleaning up STORY posts...');

    // 1. Fetch IDs first to log what we are deleting
    const { data: posts, error: fetchError } = await supabase
        .from('posts')
        .select('id, title, settings:type') // 'matches' check? No, just 'posts'
        .eq('type', 'STORY');

    if (fetchError) {
        console.error('❌ Fetch Failed:', fetchError);
        return;
    }

    console.log(`Found ${posts.length} STORY posts to delete.`);

    if (posts.length === 0) {
        console.log('✅ No posts to delete.');
        return;
    }

    // 2. Delete
    const { error: deleteError } = await supabase
        .from('posts')
        .delete()
        .eq('type', 'STORY');

    if (deleteError) {
        console.error('❌ Delete Failed:', deleteError);
        console.log('💡 Hint: RLS might be blocking deletion. You might need to truncate via Table Editor or disable RLS temporarily.');
    } else {
        console.log('✅ Successfully deleted STORY posts.');
    }
}

cleanStoryPosts();
