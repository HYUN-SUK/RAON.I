import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

// .env.local 파일 파싱
const envPath = path.resolve(process.cwd(), '.env.local');
const envContent = fs.readFileSync(envPath, 'utf-8');
const env = {};
envContent.split('\n').forEach(line => {
    const match = line.match(/^\s*([\w.-]+)\s*=\s*(.*)?\s*$/);
    if (match) {
        const key = match[1];
        let value = match[2] || '';
        if (value.startsWith('"') && value.endsWith('"')) {
            value = value.substring(1, value.length - 1);
        }
        env[key] = value;
    }
});

const SUPABASE_URL = env['NEXT_PUBLIC_SUPABASE_URL'];
const ANON_KEY = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];
const SERVICE_KEY = env['SUPABASE_SERVICE_ROLE_KEY'];

if (!SUPABASE_URL || !ANON_KEY || !SERVICE_KEY) {
    console.error('필요한 Supabase 설정값을 .env.local에서 찾을 수 없습니다.');
    process.exit(1);
}

// 1. Anon 클라이언트 (RLS 적용)
const anonClient = createClient(SUPABASE_URL, ANON_KEY);

// 2. Admin 클라이언트 (RLS 우회)
const adminClient = createClient(SUPABASE_URL, SERVICE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false
    }
});

const targetEmail = 'tootg@naver.com';

async function diagnose() {
    console.log(`=== [진단 시작] 대상 이메일: ${targetEmail} ===`);
    console.log(`Supabase URL: ${SUPABASE_URL}\n`);

    // 1. auth.users 테이블에서 이메일 검색
    console.log('1. Auth User 검색 중...');
    const { data: users, error: userError } = await adminClient.auth.admin.listUsers();
    if (userError) {
        console.error('사용자 목록을 가져오지 못했습니다:', userError.message);
        return;
    }

    const user = users.users.find(u => u.email === targetEmail);
    if (!user) {
        console.log(`❌ Auth User 에 이메일 ${targetEmail} 계정이 존재하지 않습니다.`);
        console.log('현재 가입된 전체 이메일 목록:');
        users.users.forEach(u => console.log(` - ${u.email} (${u.id})`));
        return;
    }

    const userId = user.id;
    console.log(`✅ 사용자 발견! User ID (UUID): ${userId}`);
    console.log(`가입 일자: ${user.created_at}`);
    console.log(`마지막 로그인: ${user.last_sign_in_at || '기록 없음'}\n`);

    const today = new Date().toISOString().split('T')[0];
    console.log(`비교 기준 오늘 날짜 (today): ${today}\n`);

    // 2. reservations 테이블 조회 (Admin vs Anon)
    console.log('2. [reservations] 테이블 조회 검증');
    
    // Admin 조회
    const { data: adminRes, error: adminResErr } = await adminClient
        .from('reservations')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'CANCELLED')
        .lt('check_out_date', today);

    if (adminResErr) {
        console.error(' - Admin 조회 에러:', adminResErr.message);
    } else {
        console.log(` - Admin (RLS 우회) 조회 성공: ${adminRes.length}건 발견`);
        if (adminRes.length > 0) {
            console.log('   발견된 예약 샘플:');
            adminRes.forEach(r => console.log(`   * 예약ID: ${r.id}, 사이트: ${r.site_id}, 퇴실일: ${r.check_out_date}, 상태: ${r.status}`));
        }
    }

    // Anon 조회
    const { data: anonRes, error: anonResErr } = await anonClient
        .from('reservations')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'CANCELLED')
        .lt('check_out_date', today);

    if (anonResErr) {
        console.error(' - Anon (RLS 적용) 조회 에러:', anonResErr.message);
    } else {
        console.log(` - Anon (RLS 적용) 조회 성공: ${anonRes.length}건 발견`);
    }

    console.log('');

    // 3. user_schedules 테이블 조회 (Admin vs Anon)
    console.log('3. [user_schedules] 테이블 조회 검증');
    
    // Admin 조회
    const { data: adminSchedules, error: adminSchedErr } = await adminClient
        .from('user_schedules')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'cancelled')
        .lt('check_out', today);

    if (adminSchedErr) {
        console.error(' - Admin 조회 에러:', adminSchedErr.message);
    } else {
        console.log(` - Admin (RLS 우회) 조회 성공: ${adminSchedules.length}건 발견`);
        if (adminSchedules.length > 0) {
            console.log('   발견된 일정 샘플:');
            adminSchedules.forEach(s => console.log(`   * 일정ID: ${s.id}, 캠핑장: ${s.campground_name}, 퇴실일: ${s.check_out}, 상태: ${s.status}`));
        }
    }

    // Anon 조회
    const { data: anonSchedules, error: anonSchedErr } = await anonClient
        .from('user_schedules')
        .select('*')
        .eq('user_id', userId)
        .neq('status', 'cancelled')
        .lt('check_out', today);

    if (anonSchedErr) {
        console.error(' - Anon (RLS 적용) 조회 에러:', anonSchedErr.message);
    } else {
        console.log(` - Anon (RLS 적용) 조회 성공: ${anonSchedules.length}건 발견`);
    }

    console.log('\n=== [진단 종료] ===');
}

diagnose();
