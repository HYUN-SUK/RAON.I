import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables locally
import fs from 'fs';
const envPath = path.resolve(process.cwd(), '.env.local');
console.log('Loading .env.local from:', envPath);

try {
    const envConfig = dotenv.parse(fs.readFileSync(envPath));
    for (const k in envConfig) {
        process.env[k] = envConfig[k];
    }
} catch (e) {
    console.error('Failed to read .env.local', e);
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ Missing API Credentials in .env.local');
    console.log('Loaded keys:', Object.keys(process.env).filter(k => k.includes('SUPABASE')));
    if (!supabaseUrl) console.log('Missing: URL');
    if (!serviceRoleKey) console.log('Missing: Service Key');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const ADMIN_EMAIL = 'admin@raon.ai';
const ADMIN_PASSWORD = 'password1234!';

async function resetAdmin() {
    console.log(`🔄 Attempting to reset admin user: ${ADMIN_EMAIL}`);

    // 1. Check if user exists
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('❌ Failed to list users:', listError.message);
        return;
    }

    const existingUser = users.find(u => u.email === ADMIN_EMAIL);

    if (existingUser) {
        console.log(`found existing user ${existingUser.id}, updating password...`);
        const { data, error } = await supabase.auth.admin.updateUserById(
            existingUser.id,
            {
                password: ADMIN_PASSWORD,
                user_metadata: { role: 'admin' },
                email_confirm: true
            }
        );
        if (error) {
            console.error('❌ Failed to update admin:', error.message);
        } else {
            console.log('✅ Admin password updated successfully!');
            console.log(`📧 Email: ${ADMIN_EMAIL}`);
            console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
        }
    } else {
        console.log('User not found, creating new admin...');
        const { data, error } = await supabase.auth.admin.createUser({
            email: ADMIN_EMAIL,
            password: ADMIN_PASSWORD,
            email_confirm: true,
            user_metadata: { role: 'admin' }
        });

        if (error) {
            console.error('❌ Failed to create admin:', error.message);
        } else {
            console.log('✅ Admin user created successfully!');
            console.log(`📧 Email: ${ADMIN_EMAIL}`);
            console.log(`🔑 Password: ${ADMIN_PASSWORD}`);
        }
    }
}

resetAdmin();
