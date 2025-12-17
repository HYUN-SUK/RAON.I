
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function seedPost() {
    console.log('🌱 Seeding Post...');

    const { data, error } = await supabase
        .from('posts')
        .insert({
            type: 'NOTICE',
            title: 'Test Interaction Post',
            content: 'This is a test post to verify Like and Comment features.\n\nPlease like and comment!',
            author_name: 'System Admin',
            images: [],
            meta_data: {}
        })
        .select()
        .single();

    if (error) {
        console.error('❌ Data Seed Failed:', error);
    } else {
        console.log('✅ Post Seeded ID:', data.id);
        console.log('Title:', data.title);
    }
}

seedPost();
