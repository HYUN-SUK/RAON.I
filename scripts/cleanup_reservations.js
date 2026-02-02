// scripts/cleanup_reservations.js
// 취소됨/환불완료 예약 데이터 정리 스크립트
require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ 환경변수가 설정되지 않았습니다.');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function cleanupReservations() {
    console.log('🔍 삭제 대상 예약 조회 중...\n');

    // 1. 삭제 대상 조회
    const { data: targets, error: fetchError } = await supabase
        .from('reservations')
        .select('id, site_id, status, created_at')
        .in('status', ['CANCELLED', 'REFUNDED'])
        .order('created_at', { ascending: true });

    if (fetchError) {
        console.error('❌ 조회 오류:', fetchError.message);
        process.exit(1);
    }

    if (!targets || targets.length === 0) {
        console.log('✅ 삭제할 예약이 없습니다.');
        return;
    }

    console.log(`📋 삭제 대상: ${targets.length}건\n`);
    targets.forEach((r, i) => {
        console.log(`  ${i + 1}. [${r.status}] ${r.site_id} | ${r.created_at}`);
    });

    // 2. 삭제 실행
    console.log('\n🗑️ 삭제 진행 중...');

    const { error: deleteError, count } = await supabase
        .from('reservations')
        .delete({ count: 'exact' })
        .in('status', ['CANCELLED', 'REFUNDED']);

    if (deleteError) {
        console.error('❌ 삭제 오류:', deleteError.message);
        process.exit(1);
    }

    console.log(`\n✅ ${count}건의 예약이 삭제되었습니다.`);
}

cleanupReservations();
