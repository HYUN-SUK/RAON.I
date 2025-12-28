
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabase = createClient(supabaseUrl, supabaseKey);

async function fixMission() {
    const now = new Date();
    // Start yesterday, End tomorrow
    const yesterday = new Date(now); yesterday.setDate(now.getDate() - 1);
    const tomorrow = new Date(now); tomorrow.setDate(now.getDate() + 1);

    const { data: missions } = await supabase
        .from('missions')
        .select('*')
        .eq('is_active', true)
        .limit(1);

    if (missions && missions.length > 0) {
        const m = missions[0];
        console.log(`Updating mission ${m.title} (${m.id})`);

        const { error } = await supabase
            .from('missions')
            .update({
                start_date: yesterday.toISOString(),
                end_date: tomorrow.toISOString()
            })
            .eq('id', m.id);

        if (error) console.error("Update failed:", error);
        else console.log("Update success!");
    } else {
        console.log("No active mission found to update. creating one?");
        // Optional: Create one if needed, but likely one exists just expired?
        // Let's check non-active ones too.
        const { data: anyMission } = await supabase.from('missions').select('*').limit(1);
        if (anyMission && anyMission.length > 0) {
            const m = anyMission[0];
            console.log(`Found inactive mission ${m.title}, activating...`);
            await supabase.from('missions').update({
                is_active: true,
                start_date: yesterday.toISOString(),
                end_date: tomorrow.toISOString()
            }).eq('id', m.id);
            console.log("Activated!");
        } else {
            console.log("No missions at all.");
        }
    }
}

fixMission();
