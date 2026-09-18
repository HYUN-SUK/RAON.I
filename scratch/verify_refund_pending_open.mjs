import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, serviceKey);

async function verifyRefundPendingAvailability() {
  console.log('====================================================');
  console.log('🧪 [마일스톤 9.55 실측 검증] REFUND_PENDING 빈자리 가용성 점검');
  console.log('====================================================\n');

  // 1. 현재 DB의 reservations 중 REFUND_PENDING 상태 레코드 조회
  const { data: refundPendingList, error: qErr } = await supabase
    .from('reservations')
    .select('id, site_id, check_in_date, check_out_date, status')
    .eq('status', 'REFUND_PENDING')
    .limit(5);

  if (qErr) {
    console.error('❌ 조회 에러:', qErr.message);
    return;
  }

  console.log(`📋 현재 REFUND_PENDING 상태 예약 건수: ${refundPendingList?.length || 0}건`);
  if (refundPendingList && refundPendingList.length > 0) {
    console.log('샘플 레코드:', refundPendingList[0]);
  }

  // 2. get_public_reservations RPC를 통해 REFUND_PENDING이 공개 마감 목록에서 제외되는지 테스트
  console.log('\n🔍 get_public_reservations RPC 가용성 점검...');
  const { data: pubData, error: pubErr } = await supabase.rpc('get_public_reservations', {
    p_start_date: '2026-09-01',
    p_end_date: '2026-12-31'
  });

  if (pubErr) {
    console.error('❌ get_public_reservations RPC 에러:', pubErr.message);
  } else {
    const hasRefundPendingInPublic = pubData?.some(r => r.status === 'REFUND_PENDING');
    console.log(`  👉 get_public_reservations 반환 건수: ${pubData?.length}건`);
    console.log(`  👉 REFUND_PENDING 상태가 공개 목록에 노출되는가?: ${hasRefundPendingInPublic ? '예 (아직 SQL 미적용)' : '아니오 (완벽히 제외됨! 빈자리 정상 표출)'}`);
  }

  console.log('\n====================================================');
  console.log('✅ 검증 스크립트 실행 완료');
  console.log('====================================================');
}

verifyRefundPendingAvailability();
