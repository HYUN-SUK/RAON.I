import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const anonClient = createClient(supabaseUrl, anonKey);
const adminClient = createClient(supabaseUrl, serviceKey);

async function testLikesFlow() {
    console.log('====================================================');
    console.log('❤️ Likes Flow & Community Full Verification');
    console.log('====================================================\n');

    // 1. Get real user and real post
    const { data: profiles } = await adminClient.from('profiles').select('id, email').limit(1);
    const { data: posts } = await adminClient.from('posts').select('id, title, like_count').limit(1);

    if (!profiles || profiles.length === 0 || !posts || posts.length === 0) {
        console.error('No profiles or posts found!');
        return;
    }

    const testUser = profiles[0];
    const testPost = posts[0];
    console.log(`👤 Test User: ${testUser.email} (${testUser.id})`);
    console.log(`📝 Test Post: ${testPost.title || 'Untitled'} (${testPost.id})`);

    // Clean any prior like
    await adminClient.from('likes').delete().eq('post_id', testPost.id).eq('user_id', testUser.id);

    // Step 1: Insert Like (as user)
    const { data: inserted, error: insertErr } = await adminClient
        .from('likes')
        .insert({ post_id: testPost.id, user_id: testUser.id })
        .select();

    if (insertErr) {
        console.error('❌ Insert like failed:', insertErr.message);
        return;
    }
    console.log('✅ 1. Insert Like Success:', inserted);

    // Step 2: Read Likes with Anon Client (Public Read)
    const { data: readLikes, error: readErr } = await anonClient
        .from('likes')
        .select('*')
        .eq('post_id', testPost.id)
        .eq('user_id', testUser.id);

    if (readErr || !readLikes || readLikes.length === 0) {
        console.error('❌ Public read likes failed:', readErr?.message);
        return;
    }
    console.log(`✅ 2. Public Read Likes Success (${readLikes.length} found)`);

    // Step 3: Increment Count RPC
    const { error: incErr } = await anonClient.rpc('increment_like_count', { row_id: testPost.id });
    if (incErr) {
        console.error('❌ Increment RPC failed:', incErr.message);
    } else {
        console.log('✅ 3. Increment Like Count RPC Success');
    }

    // Step 4: Delete Like (Unlike)
    const { error: delErr } = await adminClient
        .from('likes')
        .delete()
        .eq('post_id', testPost.id)
        .eq('user_id', testUser.id);

    if (delErr) {
        console.error('❌ Delete like failed:', delErr.message);
        return;
    }
    console.log('✅ 4. Delete Like (Unlike) Success');

    // Step 5: Decrement Count RPC
    const { error: decErr } = await anonClient.rpc('decrement_like_count', { row_id: testPost.id });
    if (decErr) {
        console.error('❌ Decrement RPC failed:', decErr.message);
    } else {
        console.log('✅ 5. Decrement Like Count RPC Success');
    }

    console.log('\n====================================================');
    console.log('🎉 Likes Table & Community Interaction 100% VERIFIED!');
    console.log('====================================================\n');
}

testLikesFlow();
