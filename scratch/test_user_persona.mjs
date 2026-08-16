import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function testUserPersona() {
    // tootg@naver.com 유저 ID 찾기
    const { data: userProfile } = await supabase
        .from('profiles')
        .select('*')
        .eq('email', 'tootg@naver.com')
        .maybeSingle();

    console.log('tootg@naver.com profile:', userProfile);

    // 해당 유저의 user_camping_profiles 조회
    if (userProfile) {
        const { data: campingProfile } = await supabase
            .from('user_camping_profiles')
            .select('*')
            .eq('user_id', userProfile.id)
            .maybeSingle();
        console.log('user_camping_profiles:', campingProfile);
    }
}

testUserPersona();
