
import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

// Load .env.local manually to ensure we get the keys
// (dotenv.config() might look for .env by default)
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
} else {
    console.warn(".env.local not found at", envPath);
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RAON_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing Supabase URL or Service Role Key");
    console.error("URL:", SUPABASE_URL);
    console.error("KEY:", SUPABASE_SERVICE_ROLE_KEY ? "Found (hidden)" : "Missing");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// You can find the user ID from the previous debug output or hardcode it if known.
// Using the ID from the logs: 94097cce-e6dd-4e9f-b209-da44647b986d (This was the SCHEDULE id? No wait, that was schedule ID)
// Let's use the USER_ID associated with the schedule. The schedule found was for user...
// Wait, I need the user ID. I'll Fetch the user ID from the schedule first or just assume it's the main test user.
// Based on previous logs, the user_id was likely implicit in the query.
// I will query push_tokens for ALL tokens to see what's there, as there probably aren't many users.

async function checkTokens() {
    console.log(`Checking all push tokens...`);
    const { data, error } = await supabase
        .from('push_tokens')
        .select('*');

    if (error) {
        console.error('Error fetching tokens:', error);
        return;
    }

    const output = data.map(t => ({
        user_id: t.user_id,
        token: t.token.substring(0, 20) + '...',
        device: t.device_type,
        created: t.created_at,
        updated: t.last_updated_at
    }));
    fs.writeFileSync('tokens.json', JSON.stringify(output, null, 2));
    console.log("Written to tokens.json");
}

checkTokens();
