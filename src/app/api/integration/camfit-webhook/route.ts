import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { startOfDay } from 'date-fns';

// 1. 캠핏 알림톡 파싱 헬퍼 함수
interface ParsedCamfitMessage {
    type: 'SUBMIT' | 'CONFIRM' | 'CANCEL';
    externalId: string;
    siteName: string;
    checkIn: Date;
    checkOut: Date;
    nights: number;
    guestName: string;
    guestPhone: string;
    totalPrice: number;
    guestDetails?: {
        adults: number;
        seniors: number;
        kids: {
            preschool: number;
            elementary: number;
            teen: number;
        };
        hasPet?: boolean;
    };
}

function parseCamfitMessage(message: string): ParsedCamfitMessage {
    let type: 'SUBMIT' | 'CONFIRM' | 'CANCEL';
    if (message.includes('신청되었습니다')) {
        type = 'SUBMIT';
    } else if (message.includes('성사되었습니다')) {
        type = 'CONFIRM';
    } else if (message.includes('예약취소') || message.includes('무통장입금 예약취소')) {
        type = 'CANCEL';
    } else {
        throw new Error('올바른 캠핏 알림톡 형식이 아닙니다. (키워드 미감지)');
    }

    const externalIdMatch = message.match(/예약번호\s*:\s*(C\d+)/);
    if (!externalIdMatch) {
        throw new Error('알림톡 텍스트 내에서 캠핏 예약번호(C...)를 식별할 수 없습니다.');
    }
    const externalId = externalIdMatch[1];

    if (type === 'CANCEL') {
        // 취소 시에는 최소한의 정보만 추출하여 반환 (매칭/취소 갱신 목적)
        const guestInfoMatch = message.match(/고객정보\s*:\s*([^\s\/]+)\s*\/\s*([\d-]+)/);
        const guestName = guestInfoMatch ? guestInfoMatch[1].trim() : '';
        const guestPhone = guestInfoMatch ? guestInfoMatch[2].trim() : '';
        
        return {
            type,
            externalId,
            siteName: '',
            checkIn: new Date(),
            checkOut: new Date(),
            nights: 0,
            guestName,
            guestPhone,
            totalPrice: 0
        };
    }

    // 캠핑존 파싱 (에어컨 대여 / 에어컨 4 -> 에어컨 4 추출)
    const campingZoneMatch = message.match(/캠핑존\s*:\s*(.+)/);
    if (!campingZoneMatch) {
        throw new Error('캠핑존 정보(사이트명)가 누락되어 파싱할 수 없습니다.');
    }
    const campingZoneRaw = campingZoneMatch[1];
    const parts = campingZoneRaw.split('/');
    const siteName = (parts[1] || parts[0]).trim();

    // 예약일자 / 입실일자 파싱 (YYYY/M/D 형식 검출)
    const dateMatches = message.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})/g);
    if (!dateMatches || dateMatches.length < 2) {
        throw new Error('알림톡 텍스트에서 입퇴실 날짜 범위를 인식하지 못했습니다.');
    }
    const checkIn = new Date(dateMatches[0].replace(/\//g, '-'));
    const checkOut = new Date(dateMatches[1].replace(/\//g, '-'));

    // 박수 파싱
    const nightsMatch = message.match(/\((\d+)박\)/);
    const nights = nightsMatch ? parseInt(nightsMatch[1]) : Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

    // 고객정보 파싱
    const guestInfoMatch = message.match(/고객정보\s*:\s*([^\s\/]+)\s*\/\s*([\d-]+)/);
    if (!guestInfoMatch) {
        throw new Error('예약자 성함 및 연락처 정보를 파싱할 수 없습니다.');
    }
    const guestName = guestInfoMatch[1].trim();
    const guestPhone = guestInfoMatch[2].trim();

    // 금액 파싱
    const priceMatch = message.match(/(?:결제금액|결제정보)\s*:\s*([\d,]+)원/);
    const totalPrice = priceMatch ? parseInt(priceMatch[1].replace(/,/g, '')) : 0;

    // 인원 정보 파싱 (성사 시에만 존재)
    let guestDetails;
    if (type === 'CONFIRM') {
        const adultMatch = message.match(/성인\s*-\s*(\d+)명/);
        const teenMatch = message.match(/청소년\s*-\s*(\d+)명/);
        const preschoolMatch = message.match(/미취학 아동\s*-\s*(\d+)명/);
        const elementaryMatch = message.match(/초등학생\s*-\s*(\d+)명/);

        guestDetails = {
            adults: adultMatch ? parseInt(adultMatch[1]) : 2,
            seniors: 0,
            kids: {
                preschool: preschoolMatch ? parseInt(preschoolMatch[1]) : 0,
                elementary: elementaryMatch ? parseInt(elementaryMatch[1]) : 0,
                teen: teenMatch ? parseInt(teenMatch[1]) : 0
            }
        };
    }

    return {
        type,
        externalId,
        siteName,
        checkIn,
        checkOut,
        nights,
        guestName,
        guestPhone,
        totalPrice,
        guestDetails
    };
}

export async function POST(req: NextRequest) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY; // RLS 우회하여 예약을 강제 적재하기 위해 Service Role Client 사용
    const supabase = createClient(supabaseUrl!, supabaseKey!);

    let rawBody: any = null;
    let messageRaw = '';
    
    try {
        rawBody = await req.json();
        messageRaw = rawBody.message || '';
    } catch (e) {
        return NextResponse.json({ success: false, error: 'INVALID_JSON', message: '요청 바디가 올바른 JSON 형식이 아닙니다.' }, { status: 400 });
    }

    // 1. 헤더 인증 검사 (Bearer Token)
    const authHeader = req.headers.get('authorization');
    const systemToken = process.env.CAMFIT_INTEGRATION_TOKEN || 'camfit-secret-2026';
    if (!authHeader || authHeader !== `Bearer ${systemToken}`) {
        return NextResponse.json({ success: false, error: 'UNAUTHORIZED', message: '인증 토큰이 불일치하거나 누락되었습니다.' }, { status: 401 });
    }

    if (!messageRaw.trim()) {
        return NextResponse.json({ success: false, error: 'EMPTY_MESSAGE', message: '수신된 알림톡 문자 텍스트가 비어 있습니다.' }, { status: 400 });
    }

    let parsed: ParsedCamfitMessage;
    
    // 2. 알림톡 파싱 시도
    try {
        parsed = parseCamfitMessage(messageRaw);
    } catch (parseErr: any) {
        // 파싱 실패 시 FAILED 로그 적재 후 즉각 리턴
        await supabase.from('camfit_integration_logs').insert({
            message_raw: messageRaw,
            external_id: null,
            status: 'FAILED',
            error_message: `파싱 오류: ${parseErr.message || '알 수 없는 규격 오류'}`
        });
        return NextResponse.json({ success: false, error: 'PARSE_ERROR', message: parseErr.message }, { status: 400 });
    }

    const { type, externalId, siteName, checkIn, checkOut, nights, guestName, guestPhone, totalPrice, guestDetails } = parsed;

    try {
        // 3. 신청(SUBMIT) 또는 성사(CONFIRM) 단계 처리 시 사이트 매핑 필요
        let mappedSiteId = '';
        let validUserId = 'c191ffa7-56e4-4be6-85b2-e5678dece820'; // 마이그레이션된 기본 폴백 사용자 ID

        // DB에서 외래키 제약조건을 만족하기 위한 유효한 유저 ID 하나 획득
        try {
            const { data: profileRow } = await supabase.from('profiles').select('id').limit(1);
            if (profileRow && profileRow.length > 0) {
                validUserId = String(profileRow[0].id);
            }
        } catch (err) {
            console.warn('[CamfitWebhook] profiles query fallback:', err);
        }

        if (type !== 'CANCEL') {
            // DB 내 전체 sites를 불러와 상호명을 공백 없이 3단계 비교
            const { data: dbSites } = await supabase.from('sites').select('id, name');
            if (dbSites) {
                const cleanTargetName = siteName.replace(/\s+/g, '');
                
                // 1단계: 공백 제거 완전 일치
                let matched = dbSites.find(s => s.name.replace(/\s+/g, '') === cleanTargetName);
                
                // 2단계: 에어컨 등 뒤에 '번'이 누락되었는지 확인 (에어컨 4 -> 에어컨 4번)
                if (!matched) {
                    matched = dbSites.find(s => s.name.replace(/\s+/g, '') === cleanTargetName + '번');
                }

                // 3단계: 한 쪽이 다른 쪽을 포함하는지 상호 포함 확인
                if (!matched) {
                    matched = dbSites.find(s => {
                        const dbNameClean = s.name.replace(/\s+/g, '');
                        return dbNameClean.includes(cleanTargetName) || cleanTargetName.includes(dbNameClean);
                    });
                }

                if (matched) {
                    mappedSiteId = String(matched.id);
                }
            }

            if (!mappedSiteId) {
                throw new Error(`사이트 매핑 실패: DB에서 '${siteName}'에 해당하는 구역명을 매칭하지 못했습니다.`);
            }
        }

        // ==========================================
        // CASE A: 예약 신청 (SUBMIT)
        // ==========================================
        if (type === 'SUBMIT') {
            const checkInStr = formatLocalDate(checkIn);
            const checkOutStr = formatLocalDate(checkOut);

            // 해당 사이트에 중복된 예약이 존재하는지 2차 체크 (CONFIRMED 또는 PENDING 상태만 차단)
            const { data: overlapping } = await supabase
                .from('reservations')
                .select('id')
                .eq('site_id', mappedSiteId)
                .in('status', ['PENDING', 'CONFIRMED'])
                .lt('check_in_date', checkOutStr)
                .gt('check_out_date', checkInStr);

            if (overlapping && overlapping.length > 0) {
                throw new Error(`동시성 충돌: 해당 날짜 및 사이트(${siteName})에 이미 예약이 선점되어 있습니다. (${checkInStr} ~ ${checkOutStr})`);
            }

            // 예약 신규 등록
            const finalDetails = {
                adults: 2,
                kids: { preschool: 0, elementary: 0, teen: 0 },
                external_reservation_id: externalId,
                source: 'CAMFIT'
            };

            const { error: insertErr } = await supabase.from('reservations').insert({
                user_id: validUserId, // 외래키 제약 방지 유효 ID 사용
                site_id: mappedSiteId,
                check_in_date: checkInStr,
                check_out_date: checkOutStr,
                nights,
                family_count: 1,
                visitor_count: 0,
                vehicle_count: 1,
                guests: 2,
                total_price: totalPrice,
                guest_name: guestName,
                guest_phone: guestPhone,
                status: 'PENDING',
                guest_details: finalDetails
            });

            if (insertErr) {
                throw new Error(`예약 생성 실패: ${insertErr.message}`);
            }

        // ==========================================
        // CASE B: 예약 성사/확정 (CONFIRM)
        // ==========================================
        } else if (type === 'CONFIRM') {
            // 기존 예약 번호를 룩업하여 상태를 CONFIRMED로 변경
            const { data: existing, error: selectErr } = await supabase
                .from('reservations')
                .select('id, guest_details')
                .filter('guest_details->>external_reservation_id', 'eq', externalId)
                .limit(1);

            if (selectErr) {
                throw new Error(`기존 예약 조회 실패: ${selectErr.message}`);
            }

            const finalDetails = {
                ...guestDetails,
                external_reservation_id: externalId,
                source: 'CAMFIT'
            };

            if (existing && existing.length > 0) {
                // 예약 상태를 확정으로 갱신
                const { error: updateErr } = await supabase
                    .from('reservations')
                    .update({
                        status: 'CONFIRMED',
                        guest_details: finalDetails
                    })
                    .eq('id', existing[0].id);

                if (updateErr) {
                    throw new Error(`예약 상태 확정 변경 실패: ${updateErr.message}`);
                }
            } else {
                // 신청 문자 누락 등으로 예약이 없는 경우, 신규 예약으로 CONFIRMED 생성
                const { error: insertErr } = await supabase.from('reservations').insert({
                    user_id: validUserId, // 외래키 제약 방지 유효 ID 사용
                    site_id: mappedSiteId,
                    check_in_date: formatLocalDate(checkIn),
                    check_out_date: formatLocalDate(checkOut),
                    nights,
                    family_count: 1,
                    visitor_count: 0,
                    vehicle_count: 1,
                    guests: (guestDetails?.adults || 2) + (guestDetails?.kids.preschool || 0) + (guestDetails?.kids.elementary || 0) + (guestDetails?.kids.teen || 0),
                    total_price: totalPrice,
                    guest_name: guestName,
                    guest_phone: guestPhone,
                    status: 'CONFIRMED',
                    guest_details: finalDetails
                });

                if (insertErr) {
                    throw new Error(`신규 확정 예약 생성 실패: ${insertErr.message}`);
                }
            }

        // ==========================================
        // CASE C: 예약 취소 (CANCEL)
        // ==========================================
        } else if (type === 'CANCEL') {
            const { data: existing, error: selectErr } = await supabase
                .from('reservations')
                .select('id')
                .filter('guest_details->>external_reservation_id', 'eq', externalId)
                .limit(1);

            if (selectErr) {
                throw new Error(`취소 대상 예약 조회 실패: ${selectErr.message}`);
            }

            if (existing && existing.length > 0) {
                const { error: updateErr } = await supabase
                    .from('reservations')
                    .update({
                        status: 'CANCELLED',
                        cancel_reason: '캠핏 예약 취소 알림 수신',
                        cancelled_at: new Date()
                    })
                    .eq('id', existing[0].id);

                if (updateErr) {
                    throw new Error(`예약 취소 변경 실패: ${updateErr.message}`);
                }
            } else {
                throw new Error(`취소 결함: 캠핏 예약번호 ${externalId}에 해당하는 기존 예약을 찾을 수 없습니다.`);
            }
        }

        // 성공 로그 적재
        await supabase.from('camfit_integration_logs').insert({
            message_raw: messageRaw,
            external_id: externalId,
            status: 'SUCCESS',
            error_message: null
        });

        return NextResponse.json({ success: true, type, externalId, message: '캠핏 알림 동기화 처리가 완료되었습니다.' });

    } catch (bizErr: any) {
        // 비즈니스 로직 중 실패 발생 시 FAILED 로그 적재
        await supabase.from('camfit_integration_logs').insert({
            message_raw: messageRaw,
            external_id: externalId,
            status: 'FAILED',
            error_message: bizErr.message || '알 수 없는 비즈니스 처리 오류'
        });
        return NextResponse.json({ success: false, error: 'PROCESS_ERROR', message: bizErr.message }, { status: 400 });
    }
}

// 로컬 KST 날짜 변환 함수
function formatLocalDate(date: Date): string {
    const d = new Date(date);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}
