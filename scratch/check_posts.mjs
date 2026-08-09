import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkPosts() {
    const { data: posts, error } = await supabase
        .from('posts')
        .select('id, title, author_name, author_id, created_at')
        .order('created_at', { ascending: false })
        .limit(20);

    if (error) {
        console.error('Error fetching posts:', error);
        return;
    }

    console.log('Total fetched posts count:', posts.length);
    console.log(JSON.stringify(posts, null, 2));
}

checkPosts();
