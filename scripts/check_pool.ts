
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

async function checkPool() {
    const { data, error } = await supabase
        .from('recommendation_pool')
        .select('id, title, process_steps, ingredients')
        .eq('category', 'cooking')
        .not('process_steps', 'is', null)
        .limit(1);

    if (error) {
        console.error(error);
        return;
    }

    if (data.length === 0) {
        console.log("No cooking recipes found with process_steps.");
        return;
    }

    const item = data[0];
    console.log("Title:", item.title);
    console.log("process_steps type:", typeof item.process_steps);
    console.log("process_steps content:", JSON.stringify(item.process_steps, null, 2));
    console.log("ingredients type:", typeof item.ingredients);
    console.log("ingredients content:", JSON.stringify(item.ingredients, null, 2));
}

checkPool();
