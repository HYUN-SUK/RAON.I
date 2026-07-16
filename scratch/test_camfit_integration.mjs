import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

// 정규식 파싱 함수 복제
function parseCamfitMessage(message) {
    let type;
    if (message.includes('신청되었습니다')) {
        type = 'SUBMIT';
    } else if (message.includes('성사되었습니다')) {
        type = 'CONFIRM';
    } else if (message.includes('예약취소') || message.includes('무통장입금 예약취소')) {
        type = 'CANCEL';
    } else {
        throw new Error('올바른 캠핏 알림톡 형식이 아닙니다.');
    }

    const externalIdMatch = message.match(/예약번호\s*:\s*(C\d+)/);
    if (!externalIdMatch) {
        throw new Error('예약번호를 찾을 수 없습니다.');
    }
    const externalId = externalIdMatch[1];

    if (type === 'CANCEL') {
        return { type, externalId, siteName: '', checkIn: new Date(), checkOut: new Date(), nights: 0, guestName: '', guestPhone: '', totalPrice: 0 };
    }

    const campingZoneMatch = message.match(/캠핑존\s*:\s*(.+)/);
    if (!campingZoneMatch) throw new Error('캠핑존 정보 누락');
    const campingZoneRaw = campingZoneMatch[1];
    const parts = campingZoneRaw.split('/');
    const siteName = (parts[1] || parts[0]).trim();

    const dateMatches = message.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/g);
    if (!dateMatches || dateMatches.length < 2) throw new Error('날짜 범위 누락');
    const checkIn = new Date(dateMatches[0].replace(/\//g, '-'));
    const checkOut = new Date(dateMatches[1].replace(/\//g, '-'));

    const nightsMatch = message.match(/\((\d+)박\)/);
    const nights = nightsMatch ? parseInt(nightsMatch[1]) : 1;

    const guestInfoMatch = message.match(/고객정보\s*:\s*([^\s\/]+)\s*\/\s*([\d-]+)/);
    if (!guestInfoMatch) throw new Error('고객정보 누락');
    const guestName = guestInfoMatch[1].trim();
    const guestPhone = guestInfoMatch[2].trim();

    const priceMatch = message.match(/(?:결제금액|결제정보)\s*:\s*([\d,]+)원/);
    const totalPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

    let guestDetails;
    if (type === 'CONFIRM') {
        const adultMatch = message.match(/성인\s*-\s*(\d+)명/);
        const teenMatch = message.match(/청소년\s*-\s*(\d+)명/);
        const preschoolMatch = message.match(/미취학 아동\s*-\s*(\d+)명/);
        guestDetails = {
            adults: adultMatch ? parseInt(adultMatch[1]) : 2,
            seniors: 0,
            kids: {
                preschool: preschoolMatch ? parseInt(preschoolMatch[1]) : 0,
                elementary: 0,
                teen: teenMatch ? parseInt(teenMatch[1]) : 0
            }
        };
    }

    return { type, externalId, siteName, checkIn, checkOut, nights, guestName, guestPhone, totalPrice, guestDetails };
}

// 가상 문자 테스트 셋
const testMessages = {
    submitAircon: `라온아이오토캠핑장 신규 예약이 신청되었습니다.

예약번호 : C20260716999999
캠핑존 : 에어컨 대여 / 에어컨 4
예약일자 : 2026/8/22 14시 0분 ~ 2026/8/24 11시 0분 (2박)
고객정보 : 홍길동 / 01012345678
입금마감 : 2026/7/17 9시 0분 까지
결제금액 : 20,000원`,

    confirmAircon: `라온아이오토캠핑장 신규 예약이 성사되었습니다.

예약번호 : C20260716999999
캠핑존 : 에어컨 대여 / 에어컨 4
입실일자 : 2026/8/22 ~ 2026/8/24 (2박)
고객정보 : 홍길동 / 01012345678
결제정보 : 20,000원 / 무통장입금
인원정보 : 성인 - 2명 / 청소년 - 0명 / 미취학 아동 - 0명`,

    cancelAircon: `라온아이오토캠핑장 무통장입금 예약취소 알림
환불금액 확인 후 캠퍼에게 직접 환불처리 부탁 드립니다.

예약번호 : C20260716999999

캠핑존 : 에어컨 대여 / 에어컨 4
예약일자 : 2026/8/22 14시 0분 ~ 2026/8/24 11시 0분 (2박)
고객정보 : 홍길동 / 01012345678`
};

async function testPipeline() {
    console.log("=== 캠핏 파싱 및 DB 연동 드라이런 테스트 ===");

    try {
        // 1. 신청 메시지 파싱 및 삽입 테스트
        console.log("\n[1] 신청 메시지 파싱 테스트...");
        const parsedSubmit = parseCamfitMessage(testMessages.submitAircon);
        console.log("-> 파싱 결과:", parsedSubmit);

        // 3단계 유연한 사이트 매핑 로직
        const { data: dbSites } = await supabase.from('sites').select('id, name');
        const cleanTargetName = parsedSubmit.siteName.replace(/\s+/g, '');
        let matched = dbSites.find(s => s.name.replace(/\s+/g, '') === cleanTargetName);
        if (!matched) {
            matched = dbSites.find(s => s.name.replace(/\s+/g, '') === cleanTargetName + '번');
        }
        if (!matched) {
            matched = dbSites.find(s => {
                const dbNameClean = s.name.replace(/\s+/g, '');
                return dbNameClean.includes(cleanTargetName) || cleanTargetName.includes(dbNameClean);
            });
        }

        if (!matched) throw new Error(`사이트 매칭 실패: '${parsedSubmit.siteName}'에 매핑되는 사이트가 DB에 존재하지 않습니다.`);
        console.log(`-> 사이트 매핑 성공: ${parsedSubmit.siteName} => ${matched.id} (${matched.name})`);

        // 기존 중복 제거를 위해 C20260716999999 테스트 데이터 청소
        await supabase.from('reservations').delete().filter('guest_details->>external_reservation_id', 'eq', parsedSubmit.externalId);
        await supabase.from('camfit_integration_logs').delete().eq('external_id', parsedSubmit.externalId);

        // 신청 DB 인서트
        const checkInStr = parsedSubmit.checkIn.toISOString().split('T')[0];
        const checkOutStr = parsedSubmit.checkOut.toISOString().split('T')[0];
        const finalDetails = {
            adults: 2,
            kids: { preschool: 0, elementary: 0, teen: 0 },
            external_reservation_id: parsedSubmit.externalId,
            source: 'CAMFIT'
        };

        const { error: insertErr } = await supabase.from('reservations').insert({
            user_id: 'c191ffa7-56e4-4be6-85b2-e5678dece820', // 실존하는 테스트 유저 ID 사용
            site_id: matched.id,
            check_in_date: checkInStr,
            check_out_date: checkOutStr,
            nights: parsedSubmit.nights,
            family_count: 1,
            visitor_count: 0,
            vehicle_count: 1,
            guests: 2,
            total_price: parsedSubmit.totalPrice,
            guest_name: parsedSubmit.guestName,
            guest_phone: parsedSubmit.guestPhone,
            status: 'PENDING',
            guest_details: finalDetails
        });
        if (insertErr) throw insertErr;
        console.log("-> 신청 예약 등록 성공 (PENDING)");

        // 2. 확정 메시지 테스트
        console.log("\n[2] 확정 메시지 파싱 및 업데이트 테스트...");
        const parsedConfirm = parseCamfitMessage(testMessages.confirmAircon);
        const { data: existing } = await supabase
            .from('reservations')
            .select('id')
            .filter('guest_details->>external_reservation_id', 'eq', parsedConfirm.externalId);

        if (existing && existing.length > 0) {
            const { error: updateErr } = await supabase
                .from('reservations')
                .update({
                    status: 'CONFIRMED',
                    guest_details: {
                        ...parsedConfirm.guestDetails,
                        external_reservation_id: parsedConfirm.externalId,
                        source: 'CAMFIT'
                    }
                })
                .eq('id', existing[0].id);
            if (updateErr) throw updateErr;
            console.log("-> 확정 상태 변경 성공 (CONFIRMED)");
        } else {
            console.log("-> 기존 예약을 찾지 못함");
        }

        // 3. 취소 메시지 테스트
        console.log("\n[3] 취소 메시지 파싱 및 업데이트 테스트...");
        const parsedCancel = parseCamfitMessage(testMessages.cancelAircon);
        const { data: existingForCancel } = await supabase
            .from('reservations')
            .select('id')
            .filter('guest_details->>external_reservation_id', 'eq', parsedCancel.externalId);

        if (existingForCancel && existingForCancel.length > 0) {
            const { error: cancelErr } = await supabase
                .from('reservations')
                .update({
                    status: 'CANCELLED',
                    cancel_reason: '캠핏 예약 취소 알림 수신',
                    cancelled_at: new Date()
                })
                .eq('id', existingForCancel[0].id);
            if (cancelErr) throw cancelErr;
            console.log("-> 취소 상태 변경 성공 (CANCELLED)");
        }

        // 테스트 완료 후 깨끗이 삭제하여 영향 최소화
        await supabase.from('reservations').delete().filter('guest_details->>external_reservation_id', 'eq', parsedSubmit.externalId);
        console.log("\n-> 테스트 가상 데이터 청소 완료. 테스트가 완벽히 성공했습니다!");

    } catch (e) {
        console.error("테스트 실패:", e);
    }
}

testPipeline();
