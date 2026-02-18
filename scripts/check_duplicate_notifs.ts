
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

const IDS = ["f29dfabc-3595-4e6f-9e32-41e5b83d26da", "8af2f371-22f5-4afb-b11e-75bc75779a1d"];

async function checkDetails() {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .in('id', IDS);

    if (error) {
        console.error(error);
        return;
    }

    fs.writeFileSync('duplicate_details.json', JSON.stringify(data, null, 2));
    console.log("Details written to duplicate_details.json");
}

checkDetails();
