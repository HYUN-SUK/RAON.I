import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { calculateRefundRate, calculateRefundAmount } from "@/constants/refund";
import { revalidatePath } from "next/cache";
import { after } from "next/server";

export async function POST(request: NextRequest) {
    try {
        const body = await request.json().catch(() => ({}));
        const { reservationId, refundBank, refundAccount, refundHolder, cancelReason } = body;

        if (!reservationId || !refundBank || !refundAccount || !refundHolder) {
            return NextResponse.json(
                { success: false, error: "INVALID_PARAMS", message: "환불 계좌 정보를 모두 입력해 주세요." },
                { status: 400 }
            );
        }

        const supabaseAdmin = createAdminClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // =========================================================================
        // 1. 2중 안전 인증 (1순위: Bearer Token, 2순위: Cookie Session)
        // =========================================================================
        let user: { id: string; email?: string; app_metadata?: Record<string, any>; user_metadata?: Record<string, any> } | null = null;

        const authHeader = request.headers.get("authorization") || request.headers.get("Authorization");
        if (authHeader && authHeader.startsWith("Bearer ")) {
            const token = authHeader.replace("Bearer ", "").trim();
            if (token) {
                const { data: tokenData, error: tokenError } = await supabaseAdmin.auth.getUser(token);
                if (!tokenError && tokenData?.user) {
                    user = tokenData.user;
                }
            }
        }

        // Bearer 토큰이 없거나 만료된 경우 쿠키 세션으로 폴백
        if (!user) {
            try {
                const cookieSupabase = await createServerClient();
                const { data: cookieData, error: cookieError } = await cookieSupabase.auth.getUser();
                if (!cookieError && cookieData?.user) {
                    user = cookieData.user;
                }
            } catch (cookieErr) {
                console.warn("[API Cancel] Cookie fallback error:", cookieErr);
            }
        }

        if (!user) {
            return NextResponse.json(
                { success: false, error: "UNAUTHORIZED", message: "로그인이 필요합니다. 다시 로그인해 주세요." },
                { status: 401 }
            );
        }

        // =========================================================================
        // 2. 대상 예약 조회 및 권한/상태 검증
        // =========================================================================
        const { data: reservation, error: fetchErr } = await supabaseAdmin
            .from("reservations")
            .select("id, user_id, status, check_in_date, total_price, site_id")
            .eq("id", reservationId)
            .single();

        if (fetchErr || !reservation) {
            return NextResponse.json(
                { success: false, error: "NOT_FOUND", message: "예약 정보를 찾을 수 없습니다." },
                { status: 404 }
            );
        }

        const isAdmin =
            user.email === "admin@raon.ai" ||
            user.app_metadata?.role === "admin" ||
            user.user_metadata?.role === "admin";

        if (!isAdmin && user.id !== reservation.user_id) {
            return NextResponse.json(
                { success: false, error: "FORBIDDEN", message: "본인의 예약만 취소 요청할 수 있습니다." },
                { status: 403 }
            );
        }

        if (reservation.status === "REFUND_PENDING") {
            return NextResponse.json(
                { success: true, message: "이미 취소 및 환불 접수된 예약입니다.", alreadyRequested: true }
            );
        }

        if (!["PENDING", "CONFIRMED"].includes(reservation.status)) {
            return NextResponse.json(
                { success: false, error: "INVALID_STATUS", message: "취소할 수 없는 예약 상태입니다." },
                { status: 400 }
            );
        }

        // =========================================================================
        // 3. 환불율 및 환불금액 계산
        // =========================================================================
        const checkInDate = new Date(reservation.check_in_date);
        const refundRate = calculateRefundRate(checkInDate);
        const refundAmount = calculateRefundAmount(reservation.total_price || 0, checkInDate);

        // =========================================================================
        // 4. reservations 테이블 업데이트 (0.05초 초고속 커밋)
        // =========================================================================
        const nowIso = new Date().toISOString();
        const { error: updateErr } = await supabaseAdmin
            .from("reservations")
            .update({
                status: "REFUND_PENDING",
                refund_bank: String(refundBank).trim(),
                refund_account: String(refundAccount).trim(),
                refund_holder: String(refundHolder).trim(),
                cancel_reason: cancelReason ? String(cancelReason).trim() : null,
                refund_rate: refundRate,
                refund_amount: refundAmount,
                cancelled_at: nowIso,
                updated_at: nowIso,
            })
            .eq("id", reservationId);

        if (updateErr) {
            console.error("[API Cancel] DB update failed:", updateErr);
            return NextResponse.json(
                { success: false, error: "DB_ERROR", message: "환불 정보 저장에 실패했습니다. 다시 시도해 주세요." },
                { status: 500 }
            );
        }

        // =========================================================================
        // 5. 캐시 경로 무효화 (관리자/고객 실시간 동기화)
        // =========================================================================
        try {
            revalidatePath("/admin/reservations");
            revalidatePath("/admin/payments");
            revalidatePath("/myspace/reservations");
            revalidatePath("/myspace/schedule");
        } catch (revalErr) {
            console.warn("[API Cancel] Revalidation warning:", revalErr);
        }

        // =========================================================================
        // 6. 대기자 알림 백그라운드 발송 (Next.js after로 0ms 비동기 분리)
        // =========================================================================
        after(async () => {
            try {
                const { notifyWaitlistUsers } = await import("@/actions/waitlist-notifier");
                await notifyWaitlistUsers(reservation.check_in_date, reservation.site_id);
            } catch (waitlistErr) {
                console.error("[API Cancel Background] Waitlist notification error:", waitlistErr);
            }
        });

        // 0.2초 이내 즉시 성공 응답 반환
        return NextResponse.json({
            success: true,
            refundRate,
            refundAmount,
            message: "취소 요청이 완료되었습니다. 환불은 관리자 확인 후 처리됩니다.",
        });
    } catch (err: any) {
        console.error("[API Cancel] Unhandled error:", err);
        return NextResponse.json(
            { success: false, error: "INTERNAL_ERROR", message: err?.message || "서버 오류가 발생했습니다." },
            { status: 500 }
        );
    }
}
