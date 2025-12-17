
// Script to verify Supabase Storage Upload
const { createClient } = require('@supabase/supabase-js');
require('dotenv').config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function testUpload() {
    console.log('Testing Storage Upload...');

    // Create a dummy buffer
    const buffer = Buffer.from('test image content');
    const fileName = `test_${Date.now()}.txt`;

    const { data, error } = await supabase.storage
        .from('community-images')
        .upload(fileName, buffer, {
            contentType: 'text/plain'
        });

    if (error) {
        console.error('❌ Upload Failed:', error);
    } else {
        console.log('✅ Upload Success:', data);

        // Cleanup
        await supabase.storage.from('community-images').remove([fileName]);
        console.log('Cleaned up test file.');
    }
}

testUpload();
