import { createClient } from "@supabase/supabase-js";
import * as dotenv from "dotenv";
import fs from "fs";
import path from "path";

const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath });
}

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.RAON_SERVICE_ROLE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    console.error("Missing SUPABASE env vars. URL:", SUPABASE_URL, "KEY:", SUPABASE_SERVICE_ROLE_KEY ? "exists" : "missing");
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function inspectPlayPool() {
    const { data, error } = await supabase
        .from('recommendation_pool')
        .select('*')
        .eq('category', 'play');

    if (error) {
        console.error("Error fetching play data:", error);
        return;
    }

    console.log(`=== Total play items: ${data.length} ===`);
    data.forEach((item, idx) => {
        console.log(`[${idx + 1}] Title: ${item.title}`);
        console.log(`    Category: ${item.category}`);
        console.log(`    Tags: ${JSON.stringify(item.tags)}`);
        console.log(`    Description: ${item.description}`);
        console.log(`    Difficulty: ${item.difficulty}, Time: ${item.time_required}min`);
        console.log("------------------------------------------");
    });
}

inspectPlayPool();
