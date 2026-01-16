import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function findAdmin() {
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log('=== USER LIST ===');
    let adminFound = false;
    users.users.forEach(u => {
        const email = u.email;
        const id = u.id;
        const metaEmail = u.user_metadata?.email;

        if (email === 'admin@raon.ai' || metaEmail === 'admin@raon.ai') {
            console.log(`[TARGET] Admin Found: ${email} (${id})`);
            console.log(`Metadata:`, JSON.stringify(u.user_metadata));
            adminFound = true;
        } else {
            console.log(`User: ${email} (${id})`);
        }
    });

    if (!adminFound) {
        console.log('⚠️ WARNING: No user found with email admin@raon.ai');
    }
}

findAdmin();
