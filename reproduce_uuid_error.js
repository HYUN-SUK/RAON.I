
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

async function reproduce() {
    let output = "";

    try {
        output += "Attempting to reproduce UUID error...\n";

        // 1. Get a valid user_id
        const { data: user } = await supabase.from('user_schedules').select('user_id').limit(1).single();
        const userId = user?.user_id;

        if (!userId) {
            console.log("No user found.");
            return;
        }

        output += `Using User ID: ${userId}\n`;

        const baseNotification = {
            user_id: userId,
            category: 'schedule',
            event_type: 'schedule_reminder',
            title: 'Repro Test',
            body: 'Body',
            is_read: false
        };

        // Test 1: Integer 82 (Expect Error)
        output += "\n--- Test 1: Integer 82 ---\n";
        const n1 = { ...baseNotification, data: { route: '/test', recipeId: 82 } };
        const { error: e1 } = await supabase.from('notifications').insert(n1);
        if (e1) output += `Test 1 Failed: ${e1.message} (Code: ${e1.code})\n`;
        else output += "Test 1 SUCCEEDED (Unexpected)\n";

        // Test 2: String "82"
        output += "\n--- Test 2: String '82' ---\n";
        const n2 = { ...baseNotification, data: { route: '/test', recipeId: "82" } };
        const { error: e2 } = await supabase.from('notifications').insert(n2);
        if (e2) output += `Test 2 Failed: ${e2.message}\n`;
        else output += "Test 2 SUCCEEDED\n";

        // Test 3: No recipeId
        output += "\n--- Test 3: No recipeId ---\n";
        const n3 = { ...baseNotification, data: { route: '/test' } };
        const { error: e3 } = await supabase.from('notifications').insert(n3);
        if (e3) output += `Test 3 Failed: ${e3.message}\n`;
        else output += "Test 3 SUCCEEDED\n";

        // Test 4: UUID recipeId
        output += "\n--- Test 4: UUID recipeId ---\n"; // UUID: 123e4567-e89b-12d3-a456-426614174000
        const n4 = { ...baseNotification, data: { route: '/test', recipeId: '123e4567-e89b-12d3-a456-426614174000' } };
        const { error: e4 } = await supabase.from('notifications').insert(n4);
        if (e4) output += `Test 4 Failed: ${e4.message}\n`;
        else output += "Test 4 SUCCEEDED\n";

    } catch (e) {
        output += `Script Error: ${e.message}\n${e.stack}\n`;
        console.error("Script error:", e);
    } finally {
        fs.writeFileSync('repro_log.txt', output, 'utf8');
        console.log("Log saved to repro_log.txt");
    }
}

reproduce();
