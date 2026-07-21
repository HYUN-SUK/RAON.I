import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // 서비스 롤 키 필요 (Admin API 사용)
const supabase = createClient(supabaseUrl, supabaseKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

async function createTestUser() {
    const email = 'google-test@raon.i.co.kr';
    const password = 'raoni-google-test123!';
    
    console.log("=== 구글 검수용 테스트 계정 생성 중 ===");
    
    const { data, error } = await supabase.auth.admin.createUser({
        email: email,
        password: password,
        email_confirm: true // 이메일 인증 완료 상태로 생성
    });

    if (error) {
        console.error("❌ 계정 생성 실패:", error.message);
        
        // 이미 존재하는 계정인지 확인하기 위한 가드
        if (error.message.includes("already exists") || error.message.includes("already registered")) {
            console.log("ℹ️ 이미 존재하는 계정입니다. 해당 계정을 그대로 사용하시면 됩니다.");
        }
        return;
    }

    console.log("✅ 계정이 성공적으로 생성되었습니다!");
    console.log(`- 아이디: ${email}`);
    console.log(`- 비밀번호: ${password}`);
}

createTestUser();
