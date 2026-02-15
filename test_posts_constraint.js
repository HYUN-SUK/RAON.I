
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const fs = require('fs');

async function testConstraint() {
    let output = "";
    output += "Testing 'posts' constraint...\n";

    // Test 1: Insert 'story' (Lowercase)
    const { error: e1 } = await supabase.from('posts').insert({
        type: 'story',
        title: 'Test Lowercase',
        body: 'Body',
        user_id: 'c191ffa7-56e4-4be6-85b2-e5678dece820'
    });
    output += "Insert 'story' result: " + (e1 ? e1.message : "Success") + "\n";
    if (e1) output += "Details: " + JSON.stringify(e1) + "\n";

    // Test 2: Insert 'STORY' (Uppercase)
    const { error: e2 } = await supabase.from('posts').insert({
        type: 'STORY',
        title: 'Test Uppercase',
        body: 'Body',
        user_id: 'c191ffa7-56e4-4be6-85b2-e5678dece820'
    });
    output += "Insert 'STORY' result: " + (e2 ? e2.message : "Success") + "\n";
    if (e2) output += "Details: " + JSON.stringify(e2) + "\n";

    fs.writeFileSync('constraint_test_log.txt', output, 'utf8');
    console.log("Log saved into constraint_test_log.txt");
}

testConstraint();
