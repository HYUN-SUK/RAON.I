import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJune30Reviews() {
    console.log('Inspecting posts table for June 30 reviews...');

    // Fetch posts created on June 30 or matching June 30 date
    const { data: posts, error } = await supabase
        .from('posts')
        .select('*')
        .order('created_at', { ascending: false });

    if (error) {
        console.error('Error fetching posts:', error);
        return;
    }

    // Filter posts from June 30 (e.g. created_at starts with 2026-06-30 or 2025-06-30 or date field)
    const june30Posts = posts.filter(p => {
        const createdAt = p.created_at || '';
        const isJune30 = createdAt.includes('-06-30');
        const isReview = p.type === 'REVIEW';
        return isJune30 || (isReview && createdAt.includes('-06-30'));
    });

    console.log(`Found ${june30Posts.length} posts matching June 30:`);
    june30Posts.forEach(p => {
        console.log(`- ID: ${p.id} | Type: ${p.type} | Title: "${p.title}" | Author: ${p.author_name} | CreatedAt: ${p.created_at}`);
    });
}

checkJune30Reviews();
