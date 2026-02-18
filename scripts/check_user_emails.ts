
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RAON_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing credentials");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const USER_IDS = [
    "c191ffa7-56e4-4be6-85b2-e5678dece820", // The one who GOT the notification (Schedule Owner)
    "4730be31-30b5-4594-a993-d8f5a7a5e26c"  // The one with the FRESH token (Phone?)
];

async function checkEmails() {
    console.log("Fetching emails...");
    // Check profiles (public table usually has email or name) - assumption
    // Or check auth.users (requires service role, which we have)

    // Attempt 1: Check active profiles public table if it duplicates email
    const { data: profiles, error } = await supabase
        .from('profiles')
        .select('id, email, nickname') // Adjust columns based on actual schema if known
        .in('id', USER_IDS);

    if (error) {
        console.log("Profiles fetch active, trying admin.listUsers if RLS allows or needed...");
        // Actually, let's just use auth.admin.listUsers since we have active service role
        const { data: users, error: authError } = await supabase.auth.admin.listUsers();
        if (authError) {
            console.error("Auth list error:", authError);
            return;
        }

        users.users.forEach(u => {
            if (USER_IDS.includes(u.id)) {
                console.log(`User ID: ${u.id}`);
                console.log(`Email: ${u.email}`);
                console.log("---");
            }
        });
        return;
    }

    const output = profiles.map(p => ({
        id: p.id,
        email: p.email,
        nickname: p.nickname
    }));
    fs.writeFileSync('emails.json', JSON.stringify(output, null, 2));
    console.log("Written to emails.json");
}

checkEmails();
