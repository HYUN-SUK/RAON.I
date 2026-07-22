import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';

const envConfig = dotenv.parse(fs.readFileSync(path.resolve(process.cwd(), '.env.local')));
const supabaseUrl = envConfig.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = envConfig.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

async function syncAdmin() {
  console.log("=== DB profiles 내 admin@raon.ai 동기화 중 ===");
  const { data: { users }, error: listError } = await supabase.auth.admin.listUsers();
  
  if (listError) {
    console.error("❌ listUsers 실패:", listError.message);
    return;
  }
  
  const adminUser = users.find(u => u.email === 'admin@raon.ai');
  if (!adminUser) {
    console.error("❌ admin@raon.ai 사용자를 찾을 수 없음");
    return;
  }
  
  console.log("👤 adminUser ID:", adminUser.id);
  
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', adminUser.id)
    .maybeSingle();
    
  console.log("📋 기존 profile:", profile);
  
  const { error: upsertError } = await supabase
    .from('profiles')
    .update({
      is_admin: true,
      updated_at: new Date().toISOString()
    })
    .eq('id', adminUser.id);
    
  if (upsertError) {
    console.error("❌ profiles update 에러:", upsertError.message);
  } else {
    console.log("✅ admin@raon.ai profiles is_admin: true 업데이트 완벽 성공!");
  }
}

syncAdmin();
