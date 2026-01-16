import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function findAdmin() {
    const { data: { users }, error } = await supabase.auth.admin.listUsers();
    if (error) { console.error(error); return; }

    const admin = users.find(u => u.email === 'admin@raon.ai');
    if (admin) {
        console.log(admin.id);
    } else {
        console.log('Admin not found');
    }
}

findAdmin();
