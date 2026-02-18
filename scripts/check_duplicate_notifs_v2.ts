
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

const IDS = ["2d3200b7-a275-441a-9217-d2163d4171ae", "682c648a-a497-4e61-9531-1d85f128454d", "96c0bb9d-6c64-4791-b7ac-50e67c4e857b"];

async function checkDetails() {
    const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .in('id', IDS);

    if (error) {
        console.error(error);
        return;
    }

    fs.writeFileSync('duplicate_details_v2.json', JSON.stringify(data, null, 2));
    console.log("Details written to duplicate_details_v2.json");
}

checkDetails();
