import { NextRequest, NextResponse } from "next/server";
import { createClient as createServerClient } from "@/lib/supabase-server";
import { createClient } from "@supabase/supabase-js";
import crypto from "crypto";

export async function POST(request: NextRequest) {
    try {
        // 1. Authenticate user session
        const supabase = await createServerClient();
        const { data: { user }, error: authError } = await supabase.auth.getUser();

        if (authError || !user) {
            return NextResponse.json(
                { error: "UNAUTHORIZED", message: "로그인이 필요합니다." },
                { status: 401 }
            );
        }

        const email = user.email;
        if (!email) {
            return NextResponse.json(
                { error: "INVALID_USER", message: "이메일 정보가 없는 사용자입니다." },
                { status: 400 }
            );
        }

        // 2. Compute SHA-256 hash of email for signup restriction comparison
        const emailHash = crypto.createHash("sha256").update(email.toLowerCase().trim()).digest("hex");

        // 3. Trigger OAuth Unlink (Social Revocation) if applicable
        const identities = user.identities || [];
        const provider = identities[0]?.provider;

        if (provider === "kakao") {
            const kakaoUid = identities[0]?.id; // Social login ID
            const adminKey = process.env.KAKAO_REST_API_KEY; // Using REST API Key as fallback or App Admin Key
            
            if (kakaoUid && adminKey) {
                try {
                    // Try to unlink user app-relation using Kakao Admin/REST endpoint
                    await fetch("https://kapi.kakao.com/v1/user/unlink", {
                        method: "POST",
                        headers: {
                            "Authorization": `KakaoAK ${adminKey}`,
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: new URLSearchParams({
                            target_id_type: "user_id",
                            target_id: kakaoUid
                        })
                    });
                    console.log(`[Withdraw] Kakao social unlink success for UID: ${kakaoUid}`);
                } catch (err) {
                    console.error("[Withdraw] Kakao social unlink failed:", err);
                    // Continue deletion even if social unlink fails to prevent locking user database state
                }
            }
        }

        // 4. Invoke Postgres Database RPC to copy records, anonymize community, and purge user profile
        const { error: rpcError } = await supabase.rpc("fn_withdraw_user", {
            p_user_id: user.id,
            p_email_hash: emailHash
        });

        if (rpcError) {
            console.error("[Withdraw] DB RPC Execution Error:", rpcError);
            if (rpcError.message?.includes("ACTIVE_RESERVATION_EXISTS")) {
                return NextResponse.json(
                    { 
                        error: "ACTIVE_RESERVATION_EXISTS", 
                        message: "아직 이용 완료되거나 취소되지 않은 예약이 남아있어 탈퇴가 불가능합니다." 
                    },
                    { status: 400 }
                );
            }
            throw rpcError;
        }

        // 5. Hard delete user account from auth.users via Supabase Service Role Client
        const supabaseAdmin = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        const { error: deleteError } = await supabaseAdmin.auth.admin.deleteUser(user.id);
        if (deleteError) {
            console.error("[Withdraw] Service role Auth User deletion error:", deleteError);
            throw deleteError;
        }

        // 6. Sign out session on client-side helper cookie
        await supabase.auth.signOut();

        const response = NextResponse.json({ success: true, message: "회원 탈퇴가 성공적으로 완료되었습니다." });
        
        // Clear auth cookies
        response.cookies.set("sb-access-token", "", { maxAge: -1 });
        response.cookies.set("sb-refresh-token", "", { maxAge: -1 });

        return response;

    } catch (err: any) {
        console.error("[Withdraw] Fatal Error during account deletion:", err);
        return NextResponse.json(
            { error: "INTERNAL_SERVER_ERROR", message: "회원 탈퇴 중 오류가 발생했습니다. 다시 시도해 주세요." },
            { status: 500 }
        );
    }
}
