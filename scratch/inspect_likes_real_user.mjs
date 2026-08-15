import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const adminClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

async function inspect() {
    // 1. Get an existing real user ID from profiles or auth
    const { data: profiles } = await adminClient.from('profiles').select('id, email').limit(3);
    console.log('Sample profiles:', profiles);

    // 2. Test likes with a real user id
    if (profiles && profiles.length > 0) {
        const realUserId = profiles[0].id;
        const { data: post } = await adminClient.from('posts').select('id').limit(1).single();

        console.log(`Testing likes with Real User ID: ${realUserId} on Post: ${post.id}`);

        const anonClient = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);

        // Delete any existing
        await adminClient.from('likes').delete().eq('post_id', post.id).eq('user_id', realUserId);

        // Insert as anon / client
        const { data: likeRes, error: insertErr } = await adminClient
            .from('likes')
            .insert({ post_id: post.id, user_id: realUserId })
            .select()
            .single();

        console.log('Insert with real user:', insertErr ? insertErr.message : 'SUCCESS', likeRes);

        // Delete test
        const { error: delErr } = await adminClient.from('likes').delete().eq('id', likeRes.id);
        console.log('Delete with real user:', delErr ? delErr.message : 'SUCCESS');
    }
}

inspect();
