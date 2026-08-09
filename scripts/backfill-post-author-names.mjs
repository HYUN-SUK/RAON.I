import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Supabase URL or Service Role Key missing in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function backfillPostAuthorNames() {
    console.log('Starting backfill for existing posts with valid author_id...');

    // 1. Fetch all users from Auth Admin
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    if (userError) {
        console.error('Error fetching users:', userError);
        process.exit(1);
    }

    const userMap = new Map();
    users.forEach(u => {
        const resolvedName = u.user_metadata?.full_name || u.user_metadata?.name || u.email?.split('@')[0] || '캠퍼';
        userMap.set(u.id, resolvedName);
    });

    // 2. Fetch posts with author_id IS NOT NULL and author_name = '홍길동'
    const { data: posts, error: postError } = await supabase
        .from('posts')
        .select('id, title, author_name, author_id')
        .not('author_id', 'is', null)
        .eq('author_name', '홍길동');

    if (postError) {
        console.error('Error fetching posts:', postError);
        process.exit(1);
    }

    console.log(`Found ${posts.length} posts with valid author_id and author_name = '홍길동'`);

    let updatedCount = 0;
    for (const post of posts) {
        const matchedName = userMap.get(post.author_id);
        if (matchedName) {
            console.log(`Updating post [${post.id}] "${post.title}": 홍길동 -> ${matchedName}`);
            const { error: updateError } = await supabase
                .from('posts')
                .update({ author_name: matchedName })
                .eq('id', post.id);

            if (updateError) {
                console.error(`Failed to update post [${post.id}]:`, updateError);
            } else {
                updatedCount++;
            }
        } else {
            console.warn(`No matching Auth user found for author_id: ${post.author_id}`);
        }
    }

    console.log(`\nBackfill Completed successfully! Updated ${updatedCount} posts.`);
}

backfillPostAuthorNames();
