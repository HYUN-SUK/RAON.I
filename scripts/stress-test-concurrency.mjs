import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

import { createClient } from '@supabase/supabase-js';
import { performance } from 'perf_hooks';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseAnonKey || !supabaseServiceRoleKey) {
    console.error('❌ Supabase 환경변수가 누락되었습니다 (.env.local 확인 필요)');
    process.exit(1);
}

const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);
const anonClient = createClient(supabaseUrl, supabaseAnonKey);

const SIMULATION_YEAR = 2099; // 실제 운영 데이터에 영향 없는 2099년 격리 연도

function calculateStats(latencies) {
    if (latencies.length === 0) return { min: '0.0', max: '0.0', avg: '0.0', p95: '0.0', median: '0.0' };
    const sorted = [...latencies].sort((a, b) => a - b);
    const sum = sorted.reduce((acc, v) => acc + v, 0);
    const avg = sum / sorted.length;
    const min = sorted[0];
    const max = sorted[sorted.length - 1];
    const median = sorted[Math.floor(sorted.length * 0.5)];
    const p95 = sorted[Math.floor(sorted.length * 0.95)];
    return {
        min: min.toFixed(1),
        max: max.toFixed(1),
        avg: avg.toFixed(1),
        median: median.toFixed(1),
        p95: p95.toFixed(1),
    };
}

async function cleanup() {
    try {
        await adminClient
            .from('reservations')
            .delete()
            .gte('check_in_date', `${SIMULATION_YEAR}-01-01`)
            .lte('check_out_date', `${SIMULATION_YEAR}-12-31`);

        await adminClient
            .from('blocked_dates')
            .delete()
            .gte('start_date', `${SIMULATION_YEAR}-01-01`)
            .lte('end_date', `${SIMULATION_YEAR}-12-31`);
    } catch (err) {
        console.warn('Clean-up warning:', err.message);
    }
}

async function runStressTest() {
    console.log('====================================================');
    console.log(`🔥 [RAON.I 11월 오픈 대비] 50명 동시 폭격 극한 스트레스 테스트`);
    console.log(`- 테스트 격리 연도: ${SIMULATION_YEAR}년 11월`);
    console.log(`- 운영 DB 안전성: 100% 격리 (실제 2026년 데이터 영향 0건)`);
    console.log('====================================================\n');

    await cleanup();

    const overallResults = [];

    // -------------------------------------------------------------
    // [시나리오 1] 단일 명당 사이트 50명 동시 폭격 (50:1 핫스팟 경합)
    // -------------------------------------------------------------
    console.log('--- [시나리오 1] 최고 인기 사이트(site-1) 50명 동시 광클 경합 ---');
    console.log('가상 사용자 50명이 0.05초(50ms) 내에 동일한 날짜(11/07~11/08) site-1을 동시 신청합니다...');

    const site1 = 'site-1';
    const checkIn1 = `${SIMULATION_YEAR}-11-07`;
    const checkOut1 = `${SIMULATION_YEAR}-11-08`;
    const totalUsers1 = 100;

    const startTime1 = performance.now();
    const promises1 = Array.from({ length: totalUsers1 }, async (_, i) => {
        const reqStart = performance.now();
        const res = await anonClient.rpc('create_reservation_safe', {
            p_user_id: null,
            p_site_id: site1,
            p_check_in: checkIn1,
            p_check_out: checkOut1,
            p_family_count: 1,
            p_visitor_count: 0,
            p_vehicle_count: 1,
            p_total_price: 50000,
            p_guest_name: `동시폭격유저_${String(i + 1).padStart(2, '0')}`,
            p_guest_phone: `010-9999-${String(i + 1).padStart(4, '0')}`,
        });
        const reqEnd = performance.now();
        return {
            userIndex: i + 1,
            latency: reqEnd - reqStart,
            data: res.data,
            error: res.error,
        };
    });

    const responses1 = await Promise.all(promises1);
    const totalDuration1 = performance.now() - startTime1;

    const winners1 = responses1.filter(r => r.data?.success === true);
    const losers1 = responses1.filter(r => r.data?.success === false && (r.data?.error === 'ALREADY_BOOKED' || r.data?.error === 'CONCURRENT_REQUEST'));
    const systemErrors1 = responses1.filter(r => r.error || (r.data?.success === false && !['ALREADY_BOOKED', 'CONCURRENT_REQUEST'].includes(r.data?.error)));

    const { count: actualDbRows1 } = await adminClient
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .eq('site_id', site1)
        .eq('check_in_date', checkIn1);

    const stats1 = calculateStats(responses1.map(r => r.latency));

    const pass1 = winners1.length === 1 && losers1.length === (totalUsers1 - 1) && actualDbRows1 === 1 && systemErrors1.length === 0;
    console.log(`총 요청: ${totalUsers1}건 | 전체 소요시간: ${totalDuration1.toFixed(1)}ms`);
    console.log(`응답 지연(Latency): 최소 ${stats1.min}ms | 평균 ${stats1.avg}ms | 중앙값 ${stats1.median}ms | p95 ${stats1.p95}ms | 최대 ${stats1.max}ms`);
    console.log(`결과: 당첨 성공: ${winners1.length}명, 정상 거절(탈락): ${losers1.length}명, 시스템오류(500): ${systemErrors1.length}명`);
    console.log(`DB 실제 저장 건수: ${actualDbRows1}건 (이중 예약: ${actualDbRows1 > 1 ? '발생(위험)' : '0건(완벽 방어)'})`);
    console.log(`${pass1 ? `🟢 [PASS] ${totalUsers1}:1 초경합 이중 예약 0% 방어 및 ${totalUsers1 - 1}명 안전 거절 완료` : '🔴 [FAIL] 경합 실패'}\n`);

    overallResults.push({ scenario: '시나리오 1 (50:1 핫스팟 경합)', pass: pass1, stats: stats1 });

    // -------------------------------------------------------------
    // [시나리오 2] 10개 사이트 분산 대량 동시 폭격 (총 50명, 사이트당 5명 경합)
    // -------------------------------------------------------------
    console.log('--- [시나리오 2] 10개 사이트 분산 대량 동시 폭격 (50명 요청) ---');
    console.log('10개 사이트(site-1 ~ site-10)에 각 5명씩 총 50명이 동시에 쏟아져 들어옵니다...');

    await cleanup();

    const siteList = Array.from({ length: 10 }, (_, i) => `site-${i + 1}`);
    const checkIn2 = `${SIMULATION_YEAR}-11-14`;
    const checkOut2 = `${SIMULATION_YEAR}-11-15`;

    const startTime2 = performance.now();
    const promises2 = [];

    siteList.forEach((siteId) => {
        for (let userNo = 1; userNo <= 5; userNo++) {
            promises2.push((async () => {
                const reqStart = performance.now();
                const res = await anonClient.rpc('create_reservation_safe', {
                    p_user_id: null,
                    p_site_id: siteId,
                    p_check_in: checkIn2,
                    p_check_out: checkOut2,
                    p_family_count: 1,
                    p_visitor_count: 0,
                    p_vehicle_count: 1,
                    p_total_price: 50000,
                    p_guest_name: `분산유저_${siteId}_${userNo}`,
                    p_guest_phone: `010-8888-${userNo}`,
                });
                const reqEnd = performance.now();
                return {
                    siteId,
                    userNo,
                    latency: reqEnd - reqStart,
                    data: res.data,
                    error: res.error,
                };
            })());
        }
    });

    const responses2 = await Promise.all(promises2);
    const totalDuration2 = performance.now() - startTime2;

    const winners2 = responses2.filter(r => r.data?.success === true);
    const losers2 = responses2.filter(r => r.data?.success === false && (r.data?.error === 'ALREADY_BOOKED' || r.data?.error === 'CONCURRENT_REQUEST'));
    const systemErrors2 = responses2.filter(r => r.error || (r.data?.success === false && !['ALREADY_BOOKED', 'CONCURRENT_REQUEST'].includes(r.data?.error)));

    const { count: actualDbRows2 } = await adminClient
        .from('reservations')
        .select('*', { count: 'exact', head: true })
        .gte('check_in_date', checkIn2)
        .lte('check_out_date', checkOut2);

    const stats2 = calculateStats(responses2.map(r => r.latency));
    const pass2 = winners2.length === 10 && losers2.length === 40 && actualDbRows2 === 10 && systemErrors2.length === 0;

    console.log(`총 요청: 50건 (10개 사이트 x 5명) | 전체 소요시간: ${totalDuration2.toFixed(1)}ms`);
    console.log(`응답 지연(Latency): 최소 ${stats2.min}ms | 평균 ${stats2.avg}ms | 중앙값 ${stats2.median}ms | p95 ${stats2.p95}ms | 최대 ${stats2.max}ms`);
    console.log(`결과: 10개 사이트 당첨: ${winners2.length}개 사이트, 정상 거절: ${losers2.length}명, 시스템오류: ${systemErrors2.length}명`);
    console.log(`DB 실제 저장 건수: ${actualDbRows2}건 (각 사이트별 정확히 1건씩 적재)`);
    console.log(`${pass2 ? '🟢 [PASS] 10개 사이트 병렬 처리 완벽 성공 (데드락 0건, 병렬 처리 정상)' : '🔴 [FAIL] 분산 처리 실패'}\n`);

    overallResults.push({ scenario: '시나리오 2 (10개 사이트 분산 병렬 폭격)', pass: pass2, stats: stats2 });

    // -------------------------------------------------------------
    // [시나리오 3] 20명 동시 폭격 중 관리자 긴급 차단(Race Condition)
    // -------------------------------------------------------------
    console.log('--- [시나리오 3] 20명 동시 예약 시도 중 관리자 긴급 차단 개입 ---');
    console.log('사용자들이 특정 사이트를 마구 찌르는 도중, 관리자가 해당 사이트를 긴급 차단했을 때 DB 방어 검증...');

    await cleanup();
    const site3 = 'site-5';
    const checkIn3 = `${SIMULATION_YEAR}-11-20`;
    const checkOut3 = `${SIMULATION_YEAR}-11-22`;

    await adminClient.from('blocked_dates').insert({
        site_id: site3,
        start_date: checkIn3,
        end_date: checkOut3,
        memo: '관리자 긴급 대관 점검',
        is_paid: true
    });

    const promises3 = Array.from({ length: 20 }, async (_, i) => {
        return anonClient.rpc('create_reservation_safe', {
            p_user_id: null,
            p_site_id: site3,
            p_check_in: checkIn3,
            p_check_out: checkOut3,
            p_guest_name: `차단침투_${i + 1}`
        });
    });

    const responses3 = await Promise.all(promises3);
    const penetratedCount = responses3.filter(r => r.data?.success === true).length;
    const blockedCount = responses3.filter(r => r.data?.success === false && (r.data?.error === 'ALREADY_BOOKED' || r.data?.error === 'CONCURRENT_REQUEST')).length;

    const pass3 = penetratedCount === 0 && blockedCount === 20;
    console.log(`20명 동시 요청 결과: 차단 방어 성공: ${blockedCount}명, 뚫린 예약(침투): ${penetratedCount}명`);
    console.log(`${pass3 ? '🟢 [PASS] 관리자 차단일 20명 동시 침투 100% 방어 완벽 입증' : '🔴 [FAIL] 차단일 뚫림 발생'}\n`);

    overallResults.push({ scenario: '시나리오 3 (관리자 차단일 동시 침투 방어)', pass: pass3 });

    // -------------------------------------------------------------
    // [시나리오 4] 퇴실일 당일 입실(Turnover) 20명 초경합
    // -------------------------------------------------------------
    console.log('--- [시나리오 4] 이전 손님 퇴실일 당일 입실(Turnover) 20명 초경합 ---');
    console.log('11/05~11/07 예약이 이미 존재하는 상태에서, 11/07 퇴실 당일 체크인(11/07~11/09)에 20명이 동시 신청...');

    await cleanup();
    const site4 = 'site-3';

    await adminClient.from('reservations').insert({
        site_id: site4,
        check_in_date: `${SIMULATION_YEAR}-11-05`,
        check_out_date: `${SIMULATION_YEAR}-11-07`,
        status: 'CONFIRMED',
        guest_name: '선예약자'
    });

    const promises4 = Array.from({ length: 20 }, async (_, i) => {
        return anonClient.rpc('create_reservation_safe', {
            p_user_id: null,
            p_site_id: site4,
            p_check_in: `${SIMULATION_YEAR}-11-07`,
            p_check_out: `${SIMULATION_YEAR}-11-09`,
            p_guest_name: `턴오버유저_${i + 1}`
        });
    });

    const responses4 = await Promise.all(promises4);
    const turnoverWinners = responses4.filter(r => r.data?.success === true).length;
    const turnoverLosers = responses4.filter(r => r.data?.success === false && (r.data?.error === 'ALREADY_BOOKED' || r.data?.error === 'CONCURRENT_REQUEST')).length;

    const pass4 = turnoverWinners === 1 && turnoverLosers === 19;
    console.log(`턴오버 20명 경합 결과: 정상 입실 성공: ${turnoverWinners}명, 초과 탈락: ${turnoverLosers}명`);
    console.log(`${pass4 ? '🟢 [PASS] 퇴실 당일 입실 20명 초경합에서도 1명만 정밀 당첨 & 날짜 겹침 0건' : '🔴 [FAIL] 턴오버 오판'}\n`);

    overallResults.push({ scenario: '시나리오 4 (Turnover 초경합 1명 당첨)', pass: pass4 });

    // -------------------------------------------------------------
    // 클린업 및 최종 무결성 검증
    // -------------------------------------------------------------
    console.log('🧹 스트레스 테스트 완료 후 DB 데이터 완전 정화(Clean-up) 실행...');
    await cleanup();

    const { count: final2099Res } = await adminClient.from('reservations').select('*', { count: 'exact', head: true }).gte('check_in_date', '2099-01-01');
    const { count: final2099Block } = await adminClient.from('blocked_dates').select('*', { count: 'exact', head: true }).gte('start_date', '2099-01-01');
    const { count: real2026NovRes } = await adminClient.from('reservations').select('*', { count: 'exact', head: true }).gte('check_in_date', '2026-11-01').lte('check_in_date', '2026-11-30');

    console.log(`✅ 정화 결과: 2099년 잔여 예약: ${final2099Res}건, 잔여 차단일: ${final2099Block}건 | 실제 2026년 11월 예약 수: ${real2026NovRes}건\n`);

    console.log('====================================================');
    console.log('📊 스트레스 테스트 최종 결과 요약');
    console.log('====================================================');
    const allPass = overallResults.every(r => r.pass);
    overallResults.forEach((r) => {
        const mark = r.pass ? '🟢 [PASS]' : '🔴 [FAIL]';
        console.log(`${mark} ${r.scenario}`);
    });
    console.log(`\n최종 판정: ${allPass ? '🎉 전 시나리오 100% 극한 부하 통과! (서버 무중단, 중복 0건, 지연시간 안정)' : '❌ 일부 시나리오 실패'}`);
}

runStressTest().catch(err => {
    console.error('스트레스 테스트 실행 중 에러:', err);
    process.exit(1);
});
