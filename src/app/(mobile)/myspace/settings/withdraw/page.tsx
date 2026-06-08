"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase-client";
import { useMySpaceStore } from "@/store/useMySpaceStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";
import { Loader2, AlertTriangle, ShieldAlert, CheckCircle, ChevronLeft } from "lucide-react";

type WithdrawState = "GUIDE" | "SURVEY" | "CONFIRM" | "LOADING" | "SUCCESS" | "ERROR";

export default function WithdrawPage() {
    const router = useRouter();
    const supabase = createClient();
    const { level, raonToken, reset } = useMySpaceStore();

    // UI States
    const [state, setState] = useState<WithdrawState>("LOADING");
    const [activeBookingsCount, setActiveBookingsCount] = useState(0);
    const [agreedToLoss, setAgreedToLoss] = useState(false);
    
    // Survey State
    const [reason, setReason] = useState("");
    const [customReason, setCustomReason] = useState("");
    
    // Auth State
    const [provider, setProvider] = useState<string | null>(null);
    const [password, setPassword] = useState("");
    const [isSubmitting, setIsSubmitting] = useState(false);

    useEffect(() => {
        checkActiveReservationsAndProvider();
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const checkActiveReservationsAndProvider = async () => {
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session || !session.user) {
                toast.error("로그인이 만료되었습니다. 다시 로그인 해주세요.");
                router.push("/login");
                return;
            }

            const user = session.user;
            
            // Detect provider strictly (check both single provider and providers list)
            const isEmailUser = user.app_metadata.provider === "email" || 
                                user.app_metadata.providers?.includes("email") ||
                                !user.app_metadata.provider;
            
            setProvider(isEmailUser ? "email" : (user.app_metadata.provider || user.identities?.[0]?.provider || "social"));

            // Check if user has active future reservations
            const today = new Date().toISOString().split("T")[0];
            const { data, error } = await supabase
                .from("reservations")
                .select("id")
                .eq("user_id", user.id)
                .in("status", ["PENDING", "CONFIRMED"])
                .gte("check_in_date", today);

            if (error) throw error;

            if (data && data.length > 0) {
                setActiveBookingsCount(data.length);
                setState("ERROR"); // Lock account withdrawal
            } else {
                setState("GUIDE");
            }
        } catch (err) {
            console.error("[Withdraw] Pre-check failed:", err);
            toast.error("사용자 상태 조회 중 오류가 발생했습니다.");
            setState("GUIDE");
        }
    };

    const handleWithdrawSubmit = async () => {
        setIsSubmitting(true);
        setState("LOADING");

        try {
            const { data: { user }, error: userError } = await supabase.auth.getUser();
            if (userError || !user) {
                toast.error("사용자 인증 정보를 찾을 수 없습니다.");
                setState("CONFIRM");
                setIsSubmitting(false);
                return;
            }

            // Verify password if email provider
            if (provider === "email") {
                const userEmail = user.email || "";

                // Bypassed for developer test account
                if (userEmail !== "toot@naver.com" && userEmail !== "tootg@naver.com") {
                    try {
                        const { error: signInError } = await supabase.auth.signInWithPassword({
                            email: userEmail,
                            password: password
                        });

                        if (signInError) {
                            console.warn("[Withdraw] Password verification failed:", signInError);
                            toast.error("비밀번호가 일치하지 않습니다. 다시 입력해 주세요.");
                            setState("CONFIRM");
                            setIsSubmitting(false);
                            return;
                        }
                    } catch (verifyErr) {
                        console.error("[Withdraw] Exception during password verification:", verifyErr);
                        toast.error("비밀번호 검증 중 오류가 발생했습니다.");
                        setState("CONFIRM");
                        setIsSubmitting(false);
                        return; // Halt immediately on verification exception
                    }
                }
            }

            // Call withdrawal api route
            const res = await fetch("/api/auth/withdraw", {
                method: "POST",
                headers: { "Content-Type": "application/json" }
            });

            const result = await res.json();

            if (!res.ok) {
                throw new Error(result.message || "탈퇴 처리 중 오류가 발생했습니다.");
            }

            // Clear zustand wallet store
            reset();
            
            setState("SUCCESS");
            toast.success("회원 탈퇴가 완료되었습니다.");
            
            // Redirect to home/login after a brief duration
            setTimeout(() => {
                router.push("/login");
                router.refresh();
            }, 3000);

        } catch (err: any) {
            console.error("[Withdraw] Submission failed:", err);
            toast.error(err.message || "회원 탈퇴를 완료할 수 없습니다.");
            setState("CONFIRM");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F7F5EF] flex flex-col w-full max-w-[390px] mx-auto shadow-lg border-x border-gray-100 overflow-y-auto">
            {/* Header */}
            <div className="flex items-center px-4 h-14 bg-white border-b border-gray-100 shrink-0 sticky top-0 z-50">
                <button 
                    onClick={() => router.back()} 
                    className="p-2 text-stone-600 hover:bg-stone-50 rounded-full cursor-pointer flex items-center justify-center"
                    aria-label="뒤로 가기"
                >
                    <ChevronLeft size={22} />
                </button>
                <h2 className="text-base font-black text-stone-850 flex-1 text-center -ml-8">회원 탈퇴</h2>
            </div>

            {/* Content Body */}
            <div className="flex-1 p-6 flex flex-col justify-between">
                
                {/* 1. STATE: ERROR (Active Reservations Exist) */}
                {state === "ERROR" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-300">
                        <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center text-rose-500 border border-rose-100">
                            <ShieldAlert size={36} />
                        </div>
                        <div className="space-y-3">
                            <h3 className="text-lg font-black text-stone-800">탈퇴가 불가합니다</h3>
                            <p className="text-sm text-stone-500 leading-relaxed px-2">
                                현재 이용 대기 중이거나 진행 중인 예약이 **{activeBookingsCount}건** 존재합니다.
                            </p>
                            <p className="text-xs text-rose-500 font-bold leading-normal">
                                캠핑 완료 혹은 예약을 취소하신 후에만<br />회원 탈퇴를 진행하실 수 있습니다.
                            </p>
                        </div>
                        <Button 
                            onClick={() => router.push("/myspace/reservations")}
                            className="w-full h-12 bg-[#224732] hover:bg-[#1C4526] text-white font-bold rounded-xl active:scale-95 transition-all text-sm cursor-pointer"
                        >
                            예약 현황 보러 가기
                        </Button>
                    </div>
                )}

                {/* 2. STATE: LOADING */}
                {state === "LOADING" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                        <Loader2 className="w-10 h-10 text-[#224732] animate-spin" />
                        <div className="space-y-1">
                            <p className="text-sm font-bold text-stone-800">안전하게 탈퇴를 진행하고 있습니다</p>
                            <p className="text-xs text-stone-400">잠시만 기다려 주세요...</p>
                        </div>
                    </div>
                )}

                {/* 3. STATE: SUCCESS */}
                {state === "SUCCESS" && (
                    <div className="flex-1 flex flex-col items-center justify-center text-center space-y-6 animate-in fade-in duration-500">
                        <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center text-emerald-500 border border-emerald-100">
                            <CheckCircle size={36} />
                        </div>
                        <div className="space-y-2">
                            <h3 className="text-lg font-black text-stone-800">그동안 감사했습니다</h3>
                            <p className="text-xs text-stone-500 leading-relaxed px-4">
                                회원 탈퇴 및 보존 의무 데이터 외 개인정보 파기 처리가 안전하게 완료되었습니다. 라온아이와 함께해 주셔서 진심으로 감사드립니다.
                            </p>
                        </div>
                    </div>
                )}

                {/* 4. STATE: GUIDE (Loss of Assets Alert) */}
                {state === "GUIDE" && (
                    <div className="flex-grow flex flex-col justify-between space-y-6 animate-in fade-in duration-300">
                        <div className="space-y-5">
                            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 flex gap-3 text-amber-800">
                                <AlertTriangle className="w-5 h-5 shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                    <h4 className="text-xs font-black">꼭 확인해 주세요!</h4>
                                    <p className="text-[11px] leading-relaxed text-amber-700 font-medium">
                                        회원 탈퇴 시 보유하고 계신 모든 포인트, 혜택, 등급 정보가 즉시 파기되며 복구가 불가능합니다.
                                    </p>
                                </div>
                            </div>

                            {/* Wallet Summary */}
                            <div className="bg-white rounded-2xl border border-stone-150 p-4 space-y-3 shadow-sm">
                                <h4 className="text-xs font-black text-stone-800">소멸 예정 자산</h4>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="bg-stone-50/80 p-3 rounded-xl border border-stone-100">
                                        <p className="text-[10px] text-stone-400 font-bold">회원 등급</p>
                                        <p className="text-sm font-black text-stone-800 mt-1">Level {level}</p>
                                    </div>
                                    <div className="bg-stone-50/80 p-3 rounded-xl border border-stone-100">
                                        <p className="text-[10px] text-stone-400 font-bold">라온 토큰</p>
                                        <p className="text-sm font-black text-orange-600 mt-1">{raonToken} 개</p>
                                    </div>
                                </div>
                            </div>

                            {/* Post and Review Retention Info */}
                            <div className="bg-white rounded-2xl border border-stone-150 p-4 space-y-2 shadow-sm text-stone-600">
                                <h4 className="text-xs font-black text-stone-850">커뮤니티 및 데이터 정책</h4>
                                <p className="text-[11px] leading-relaxed text-stone-500">
                                    • 작성하신 커뮤니티 게시글 및 댓글은 탈퇴 후에도 자동으로 지워지지 않으며 **'탈퇴한 사용자'**로 익명화되어 유지됩니다. 삭제를 원하실 경우 반드시 탈퇴 완료 전에 삭제해 주세요.
                                </p>
                                <p className="text-[11px] leading-relaxed text-stone-500">
                                    • 전자상거래법에 의해 계약, 대금 결제, 분쟁 처리에 관한 예약 기록은 탈퇴 후에도 **5년간 분리 보존**됩니다.
                                </p>
                            </div>
                        </div>

                        {/* Consent Check & Button */}
                        <div className="space-y-4 pt-4">
                            <label className="flex items-start gap-3 p-3 bg-white rounded-xl border border-stone-150 cursor-pointer select-none">
                                <input 
                                    type="checkbox" 
                                    checked={agreedToLoss} 
                                    onChange={(e) => setAgreedToLoss(e.target.checked)}
                                    className="w-4 h-4 mt-0.5 accent-[#224732] rounded cursor-pointer shrink-0"
                                />
                                <span className="text-xs text-stone-600 font-bold leading-tight">
                                    안내사항을 모두 확인하였으며, 자산 소멸 및 데이터 익명화 처리에 동의합니다.
                                </span>
                            </label>

                            <Button
                                disabled={!agreedToLoss}
                                onClick={() => setState("SURVEY")}
                                className={`w-full h-12 font-bold rounded-xl active:scale-98 transition-all text-sm cursor-pointer ${
                                    agreedToLoss 
                                        ? "bg-rose-500 hover:bg-rose-600 text-white shadow-md" 
                                        : "bg-stone-200 text-stone-400 border-none"
                                }`}
                            >
                                다음 단계로
                            </Button>
                        </div>
                    </div>
                )}

                {/* 5. STATE: SURVEY (Exit Feedbacks) */}
                {state === "SURVEY" && (
                    <div className="flex-grow flex flex-col justify-between space-y-6 animate-in fade-in duration-300">
                        <div className="space-y-4">
                            <h3 className="text-sm font-black text-stone-800">떠나시는 이유를 알려주세요 😢</h3>
                            <p className="text-[11px] text-stone-400 leading-normal">
                                더 따뜻하고 나은 서비스를 만드는 데 소중히 활용하겠습니다.
                            </p>

                            <div className="space-y-2">
                                {[
                                    "자주 사용하지 않아요",
                                    "원하는 캠핑 정보가 부족해요",
                                    "UI/UX 이용이 복잡하고 불편해요",
                                    "포인트/토큰 혜택이 매력적이지 않아요",
                                    "기타 (직접 입력)"
                                ].map((item, idx) => (
                                    <label 
                                        key={idx} 
                                        className={`flex items-center gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                            reason === item 
                                                ? "border-[#224732] bg-[#224732]/5 text-[#224732] font-bold" 
                                                : "border-stone-150 bg-white hover:bg-stone-50/50 text-stone-600"
                                        }`}
                                    >
                                        <input 
                                            type="radio" 
                                            name="survey_reason" 
                                            value={item} 
                                            checked={reason === item}
                                            onChange={() => setReason(item)}
                                            className="w-4 h-4 accent-[#224732] cursor-pointer shrink-0"
                                        />
                                        <span className="text-xs leading-none">{item}</span>
                                    </label>
                                ))}
                            </div>

                            {reason === "기타 (직접 입력)" && (
                                <textarea
                                    value={customReason}
                                    onChange={(e) => setCustomReason(e.target.value)}
                                    placeholder="상세한 사유를 한 줄 적어주세요."
                                    className="w-full h-24 p-3 bg-white border border-stone-200 rounded-xl text-xs text-stone-800 placeholder:text-stone-300 focus:outline-[#224732] focus:border-[#224732] transition-colors resize-none"
                                />
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button 
                                onClick={() => setState("GUIDE")} 
                                variant="ghost"
                                className="flex-1 h-12 border border-stone-200 text-stone-600 font-bold rounded-xl text-sm"
                            >
                                이전으로
                            </Button>
                            <Button 
                                disabled={!reason || (reason === "기타 (직접 입력)" && !customReason.trim())}
                                onClick={() => setState("CONFIRM")}
                                className={`flex-grow h-12 font-bold rounded-xl active:scale-98 transition-all text-sm cursor-pointer ${
                                    reason && (reason !== "기타 (직접 입력)" || customReason.trim())
                                        ? "bg-[#224732] hover:bg-[#1C4526] text-white shadow-md"
                                        : "bg-stone-200 text-stone-400 border-none"
                                }`}
                            >
                                탈퇴 신청
                            </Button>
                        </div>
                    </div>
                )}

                {/* 6. STATE: CONFIRM (Final Verification) */}
                {state === "CONFIRM" && (
                    <div className="flex-grow flex flex-col justify-between space-y-6 animate-in fade-in duration-300">
                        <div className="space-y-5">
                            <div className="text-center space-y-2 py-4">
                                <h3 className="text-base font-black text-stone-850">마지막으로 확인합니다</h3>
                                <p className="text-xs text-rose-500 font-bold leading-normal">
                                    본인 확인 및 최종 탈퇴 동의가 완료되면 계정이 즉시 파기되며 복구되지 않습니다.
                                </p>
                            </div>

                            {/* Provider Specific Verification UI */}
                            {provider === "email" ? (
                                <div className="space-y-3">
                                    <label className="text-xs font-bold text-stone-700 block">비밀번호 확인</label>
                                    <Input 
                                        type="password"
                                        placeholder="현재 비밀번호를 입력해 주세요."
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        className="bg-white border-stone-200 text-stone-800 h-12 rounded-xl text-sm focus:outline-[#224732]"
                                        required
                                    />
                                    <p className="text-[10px] text-stone-400">이메일 계정 소유 확인을 위해 비밀번호가 일치해야 합니다.</p>
                                </div>
                            ) : (
                                <div className="bg-stone-50 border border-stone-150 rounded-2xl p-4 space-y-2 text-center">
                                    <p className="text-xs text-stone-600 font-bold">소셜 계정 연결 정보</p>
                                    <p className="text-xs text-[#224732] font-black uppercase">{provider} 연동 로그인 회원</p>
                                    <p className="text-[10px] text-stone-400">별도의 비밀번호 없이 [탈퇴 완료] 버튼을 누르면 연동 해제 및 즉시 탈퇴가 처리됩니다.</p>
                                </div>
                            )}
                        </div>

                        <div className="flex gap-2">
                            <Button 
                                onClick={() => setState("SURVEY")} 
                                variant="ghost"
                                disabled={isSubmitting}
                                className="flex-1 h-12 border border-stone-200 text-stone-600 font-bold rounded-xl text-sm cursor-pointer"
                            >
                                이전으로
                            </Button>
                            <Button 
                                onClick={handleWithdrawSubmit}
                                disabled={isSubmitting || (provider === "email" && !password.trim())}
                                className="flex-grow h-12 bg-rose-500 hover:bg-rose-600 text-white font-bold rounded-xl shadow-md active:scale-98 transition-all text-sm cursor-pointer"
                            >
                                {isSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "탈퇴 완료"}
                            </Button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
