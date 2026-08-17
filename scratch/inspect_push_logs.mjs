import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function inspectPushLogs() {
    console.log('====================================================');
    console.log('🔍 푸시 알림 발송 및 토큰 등록 현황 점검');
    console.log('====================================================\n');

    // 1. 최근 발송된 notifications 조회
    const { data: notifs } = await supabase
        .from('notifications')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(10);

    console.log(`최근 알림 레코드 (${notifs?.length || 0}건):`);
    for (const n of (notifs || [])) {
        console.log(`[${n.created_at}] user: ${n.user_id} | event: ${n.event_type} | title: ${n.title} | status: ${n.status}`);
    }

    // 2. tootg@naver.com 유저 ID 찾기
    const { data: { users } } = await supabase.auth.admin.listUsers();
    const tootgUser = users.find(u => u.email === 'tootg@naver.com');
    console.log(`\nTootg User ID: ${tootgUser?.id} (${tootgUser?.email})`);

    if (tootgUser) {
        // 3. tootg 유저의 push_tokens 테이블 조회
        const { data: tokens } = await supabase
            .from('push_tokens')
            .select('*')
            .eq('user_id', tootgUser.id);

        console.log(`\nTootg 유저의 활성 push_tokens (${tokens?.length || 0}건):`);
        for (const t of (tokens || [])) {
            console.log(`- token_id: ${t.id} | active: ${t.is_active} | device: ${t.device_info || 'N/A'} | updated_at: ${t.last_updated_at || t.updated_at} | token: ${t.token?.substring(0, 20)}...`);
        }
    }
}

inspectPushLogs();
