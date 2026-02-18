
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

const supabase = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!);

const USER_ID = "4730be31-30b5-4594-a993-d8f5a7a5e26c";

async function checkTokens() {
    const { data, error } = await supabase
        .from('push_tokens')
        .select('*')
        .eq('user_id', USER_ID);

    if (error) {
        console.error(error);
        return;
    }

    fs.writeFileSync('tootg_tokens.json', JSON.stringify(data, null, 2));
    console.log("Tokens written to tootg_tokens.json");
}

checkTokens();
