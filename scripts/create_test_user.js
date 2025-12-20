const { createClient } = require('@supabase/supabase-js');
const dotenv = require('dotenv');
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
// Note: Anon key allows signUp mostly. If email confirmation is off, it works.
// If not, we might need Service Key to auto-confirm or use admin api.
// Let's try ANON first. most dev setups disable confirm.

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function createTestUser() {
    const email = 'raon_tester_01@gmail.com'; // Use a more realistic email
    const password = 'password123';

    console.log(`Creating user: ${email}`);

    const { data, error } = await supabase.auth.signUp({
        email,
        password,
    });

    if (error) {
        console.error('Error creating user obj:', JSON.stringify(error, null, 2));
        console.error('Error message:', error.message);
        // If user already exists, that's fine.
        if (error.message.includes('already registered')) {
            console.log('User already exists. Trying to sign in to verify...');
            const { data: data2, error: error2 } = await supabase.auth.signInWithPassword({
                email,
                password
            });
            if (error2) console.error("Sign in failed:", error2.message);
            else console.log("Sign in successful.");
        }
    } else {
        console.log('User created successfully:', data.user?.id);
        console.log('Check your email for confirmation link if required.');
    }
}

createTestUser();
