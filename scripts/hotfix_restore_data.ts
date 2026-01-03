import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// Manual Env Parser to avoid dependencies
function loadEnv() {
    try {
        const envPath = path.resolve(__dirname, '../.env.local');
        const envFile = fs.readFileSync(envPath, 'utf8');
        const envVars: Record<string, string> = {};

        envFile.split('\n').forEach(line => {
            const match = line.match(/^([^=]+)=(.*)$/);
            if (match) {
                const key = match[1].trim();
                const value = match[2].trim().replace(/^["']|["']$/g, '');
                envVars[key] = value;
            }
        });
        return envVars;
    } catch (e) {
        console.error("Could not read .env.local", e);
        return {};
    }
}

const env = loadEnv();
const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const serviceRoleKey = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!supabaseUrl || !serviceRoleKey) {
    console.error('❌ FATAL: Missing credentials in .env.local');
    console.error('Make sure NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are defined.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey);

async function main() {
    console.log('🔄 Starting Hotfix Restoration...');

    // 1. Restore Site Config (For Chips)
    console.log('1️⃣ Fixing Site Config...');
    const { error: configError } = await supabase.from('site_config').upsert({
        id: 1,
        address_main: '강원 화악산로 1234',
        address_detail: '라온아이 캠핑장',
        phone_number: '010-1234-5678',
        rules_guide_text: '매너타임 준수 (22:00 ~ 08:00)',
        pricing_guide_text: '평일 5만원 / 주말 7만원',
        layout_image_url: null, // Optional
        nearby_places: [
            { title: '화악산 계곡', desc: '맑은 물이 흐르는 계곡' },
            { title: '천문대', desc: '별이 쏟아지는 관측소' }
        ]
    }).select();

    if (configError) console.error('❌ Config Error:', configError.message);
    else console.log('✅ Site Config Restored.');

    // 2. Restore Active Mission (For Mission Card)
    console.log('2️⃣ Fixing Active Mission...');
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);

    const { error: missionError } = await supabase.from('missions').upsert({
        // Use a fixed ID to ensure uniqueness for this recovery
        title: '📸 (복구) 이 주의 캠핑 요리왕',
        description: '나만의 캠핑 요리를 자랑해보세요! (복구된 미션)',
        start_date: today.toISOString(),
        end_date: nextWeek.toISOString(),
        status: 'ACTIVE',
        reward_xp: 100,
        reward_point: 50,
        type: 'PHOTO'
    }).select();
    // Note: omitting ID to let it auto-gen, or we can force it if uuid.
    // Assuming ID is uuid default gen, upsert without ID creates new one.
    // Let's iterate: if we want to ensure *at least one* exists.

    if (missionError) console.error('❌ Mission Error:', missionError.message);
    else console.log('✅ Active Mission Restored.');

    // 3. Reset Admin Password
    console.log('3️⃣ Resetting Admin Password...');
    const adminEmail = 'admin@raon.ai';
    const newPassword = 'password1234!';

    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();

    if (listError) {
        console.error('❌ Failed to list users:', listError.message);
    } else {
        const adminUser = users?.find(u => u.email === adminEmail);

        if (adminUser) {
            console.log(`Found admin user ${adminUser.id}. Updating...`);
            const { error: updateError } = await supabase.auth.admin.updateUserById(
                adminUser.id,
                { password: newPassword, user_metadata: { role: 'admin' }, email_confirm: true }
            );
            if (updateError) console.error('❌ Password Reset Failed:', updateError.message);
            else console.log(`✅ Admin Password Reset to: ${newPassword}`);
        } else {
            console.log('Admin user not found. Creating...');
            const { error: createError } = await supabase.auth.admin.createUser({
                email: adminEmail,
                password: newPassword,
                email_confirm: true,
                user_metadata: { role: 'admin' }
            });
            if (createError) console.error('❌ Admin Creation Failed:', createError.message);
            else console.log(`✅ Admin Created: ${adminEmail} / ${newPassword}`);
        }
    }
}

main();
