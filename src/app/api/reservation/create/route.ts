import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { after } from "next/server";
import { dispatchPersonaAction } from "@/lib/persona";

/**
 * [신규 예약 생성 전용 REST API]
 * - 모바일 브라우저의 JWT 갱신 데드락 및 소켓 프리징을 원천 차단하기 위해,
 *   Next.js 백엔드 서버에서 2중 인증(Bearer 1순위, 쿠키 2순위) 후 Supabase DB RPC를 호출합니다.
 * - 프로필 저장 및 페르소나 기록은 Next.js after()를 통해 백그라운드 비동기로 위임하여,
 *   클라이언트는 0.05초 만에 완료 화면으로 즉시 직행합니다.
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const {
            siteId,
            checkIn,
            checkOut,
            familyCount = 1,
            visitorCount = 0,
            vehicleCount = 1,
            totalPrice = 0,
            guestName,
            guestPhone,
            requests = null,
            guestDetails = null
        } = body;

        // 1. 필수 파라미터 검증
        if (!siteId || !checkIn || !checkOut || !guestName || !guestPhone) {
            return NextResponse.json(
                { success: false, error: "INVALID_PARAMS", message: "필수 예약 정보(사이트, 날짜, 성함, 연락처)가 누락되었습니다." },
                { status: 400 }
            );
        }

        if (checkIn === checkOut) {
            return NextResponse.json(
                { success: false, error: "NIGHTS_ZERO", message: "퇴실일을 올바르게 선택해 주세요." },
                { status: 400 }
            );
        }

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 2. 2중 안전 인증 (1순위: Bearer Token, 2순위: Cookie Session)
        let userId: string | null = null;

        const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.replace("Bearer ", "").trim();
            if (token) {
                const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
                if (!tokenError && tokenData?.user) {
                    userId = tokenData.user.id;
                }
            }
        }

        // Bearer 토큰이 없거나 만료된 경우 쿠키 세션으로 폴백
        if (!userId) {
            try {
                const cookieSupabase = await createServerClient();
                const { data: cookieData, error: cookieError } = await cookieSupabase.auth.getUser();
                if (!cookieError && cookieData?.user) {
                    userId = cookieData.user.id;
                }
            } catch (cookieErr) {
                console.warn("[API Reservation Create] Cookie fallback error:", cookieErr);
            }
        }

        if (!userId) {
            return NextResponse.json(
                { success: false, error: "UNAUTHORIZED", message: "로그인이 필요합니다. 다시 로그인해 주세요." },
                { status: 401 }
            );
        }

        // 3. 동시성 제어가 적용된 DB RPC create_reservation_safe 호출
        const { data, error } = await supabaseAdmin.rpc("create_reservation_safe", {
            p_user_id: userId,
            p_site_id: siteId,
            p_check_in: checkIn,
            p_check_out: checkOut,
            p_family_count: familyCount,
            p_visitor_count: visitorCount,
            p_vehicle_count: vehicleCount,
            p_total_price: totalPrice,
            p_guest_name: guestName,
            p_guest_phone: guestPhone,
            p_requests: requests || null,
            p_guest_details: guestDetails || null
        });

        if (error) {
            console.error("[API Reservation Create] RPC execution error:", error);
            return NextResponse.json(
                { success: false, error: "RPC_ERROR", message: error.message || "데이터베이스 처리 중 오류가 발생했습니다." },
                { status: 500 }
            );
        }

        const result = data as { success: boolean; reservation_id?: string; error?: string; message?: string };

        if (!result.success) {
            const status = result.error === "ALREADY_BOOKED" ? 409 : result.error === "CONCURRENT_REQUEST" ? 429 : 400;
            return NextResponse.json(
                {
                    success: false,
                    error: result.error || "BOOKING_FAILED",
                    message: result.message || "예약을 완료할 수 없습니다."
                },
                { status }
            );
        }

        // 4. 백그라운드 후속 작업 (after API로 클라이언트 응답 후 비동기 안전 실행)
        after(async () => {
            try {
                // 4-1. 캠핑 프로필(인원 구성) 비동기 저장
                if (guestDetails && userId) {
                    await supabaseAdmin.rpc("upsert_camping_profile", {
                        p_user_id: userId,
                        p_origin_label: null,
                        p_origin_lat: null,
                        p_origin_lng: null,
                        p_adults: guestDetails.adults ?? 2,
                        p_seniors: guestDetails.seniors ?? 0,
                        p_kids_preschool: guestDetails.kids?.preschool ?? 0,
                        p_kids_elementary: guestDetails.kids?.elementary ?? 0,
                        p_kids_teen: guestDetails.kids?.teen ?? 0,
                        p_has_pet: guestDetails.hasPet ?? false
                    });
                }

                // 4-2. 페르소나 행동 로그 비동기 기록
                if (userId && guestDetails) {
                    const kidsCount = (guestDetails.kids?.preschool ?? 0) + (guestDetails.kids?.elementary ?? 0);
                    if (kidsCount > 0) {
                        await dispatchPersonaAction(userId, "RESERVATION_KIDS_INCLUDED", supabaseAdmin).catch(console.error);
                    }
                    if (guestDetails.hasPet) {
                        await dispatchPersonaAction(userId, "RESERVATION_PET_INCLUDED", supabaseAdmin).catch(console.error);
                    }
                    if (familyCount > 1) {
                        await dispatchPersonaAction(userId, "RESERVATION_FAMILY_ADDED", supabaseAdmin).catch(console.error);
                    }
                    
                    const inDate = new Date(checkIn);
                    const outDate = new Date(checkOut);
                    const nights = Math.ceil((outDate.getTime() - inDate.getTime()) / (1000 * 60 * 60 * 24));
                    if (nights >= 2) {
                        await dispatchPersonaAction(userId, "RESERVATION_MULTIPLE_NIGHTS", supabaseAdmin).catch(console.error);
                    }

                    const inDay = inDate.getDay();
                    const outDay = outDate.getDay();
                    const isWeekend = [0, 5, 6].includes(inDay) || [0, 5, 6].includes(outDay);
                    if (isWeekend) {
                        await dispatchPersonaAction(userId, "RESERVATION_WEEKEND_PEAK", supabaseAdmin).catch(console.error);
                    } else {
                        await dispatchPersonaAction(userId, "RESERVATION_WEEKDAY_LEISURE", supabaseAdmin).catch(console.error);
                    }
                }
            } catch (bgErr) {
                console.error("[API Reservation Create] Background task failed:", bgErr);
            }
        });

        // 5. 클라이언트 즉시 성공 반환
        return NextResponse.json({
            success: true,
            reservationId: result.reservation_id,
            message: result.message || "예약이 성공적으로 접수되었습니다."
        });

    } catch (err: unknown) {
        console.error("[API Reservation Create] Uncaught error:", err);
        const message = err instanceof Error ? err.message : "예약 처리 중 예기치 않은 오류가 발생했습니다.";
        return NextResponse.json(
            { success: false, error: "SERVER_ERROR", message },
            { status: 500 }
        );
    }
}
