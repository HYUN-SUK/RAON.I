"use client";

import { useState, useMemo } from "react";
import { Reservation } from "@/types/reservation";
import { useReservationStore } from "@/store/useReservationStore";
import { KOREAN_BANKS, CANCEL_REASONS, calculateRefundRate, calculateRefundAmount } from "@/constants/refund";
import { format } from "date-fns";
import { ko } from "date-fns/locale";
import { SITES } from "@/constants/sites";
import { AlertTriangle, Loader2, ChevronDown, X, BanknoteIcon } from "lucide-react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { toast } from "sonner";

interface CancelReservationSheetProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    reservation: Reservation;
    onComplete: () => void;
}

export default function CancelReservationSheet({
    open,
    onOpenChange,
    reservation,
    onComplete,
}: CancelReservationSheetProps) {
    const { requestCancelReservation } = useReservationStore();
    const [loading, setLoading] = useState(false);
    const [bankCode, setBankCode] = useState("");
    const [customBankName, setCustomBankName] = useState("");
    const [account, setAccount] = useState("");
    const [holder, setHolder] = useState("");
    const [reason, setReason] = useState("");
    const [showBankDropdown, setShowBankDropdown] = useState(false);

    // 환불율 및 환불금액 계산
    const refundRate = useMemo(() => calculateRefundRate(new Date(reservation.checkInDate)), [reservation.checkInDate]);
    const refundAmount = useMemo(
        () => calculateRefundAmount(reservation.totalPrice, new Date(reservation.checkInDate)),
        [reservation.totalPrice, reservation.checkInDate]
    );

    const site = SITES.find((s) => s.id === reservation.siteId);
    const selectedBank = KOREAN_BANKS.find((b) => b.code === bankCode);
    const displayBankName = bankCode === "OTHER" ? customBankName : selectedBank?.name || "";

    const isValid = displayBankName.trim() && account.trim() && holder.trim();

    const handleSubmit = async () => {
        if (!isValid) return;

        setLoading(true);
        const result = await requestCancelReservation({
            reservationId: reservation.id,
            refundBank: displayBankName,
            refundAccount: account,
            refundHolder: holder,
            cancelReason: reason || undefined,
        });
        setLoading(false);

        if (result.success) {
            toast.success("취소 요청이 완료되었습니다", {
                description: `환불 예정액: ${result.refundAmount?.toLocaleString()}원 (${result.refundRate}%)`,
            });
            onComplete();
        } else {
            toast.error("취소 요청 실패", {
                description: result.message || "다시 시도해주세요",
            });
        }
    };

    return (
        <Sheet open={open} onOpenChange={onOpenChange}>
            <SheetContent side="bottom" className="rounded-t-3xl max-h-[90vh] overflow-y-auto">
                <SheetHeader className="pb-4 border-b border-gray-100">
                    <SheetTitle className="flex items-center gap-2">
                        <AlertTriangle className="text-orange-500" size={20} />
                        예약 취소 요청
                    </SheetTitle>
                </SheetHeader>

                <div className="py-4 space-y-5">
                    {/* 예약 정보 요약 */}
                    <div className="bg-gray-50 rounded-xl p-4">
                        <h3 className="font-bold text-text-1 mb-2">{site?.name || reservation.siteId}</h3>
                        <p className="text-sm text-text-2">
                            {format(new Date(reservation.checkInDate), "yyyy.MM.dd (eee)", { locale: ko })}
                            {" ~ "}
                            {format(new Date(reservation.checkOutDate), "MM.dd (eee)", { locale: ko })}
                        </p>
                        <div className="flex justify-between items-center mt-3 pt-3 border-t border-gray-200">
                            <span className="text-sm text-text-2">결제 금액</span>
                            <span className="font-bold">{reservation.totalPrice.toLocaleString()}원</span>
                        </div>
                    </div>

                    {/* 환불 정보 */}
                    <div className={`rounded-xl p-4 ${refundRate === 0 ? "bg-red-50 border border-red-200" : "bg-green-50 border border-green-200"}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <BanknoteIcon size={18} className={refundRate === 0 ? "text-red-600" : "text-green-600"} />
                            <span className={`font-bold ${refundRate === 0 ? "text-red-700" : "text-green-700"}`}>
                                환불 정책
                            </span>
                        </div>
                        <div className="text-sm space-y-1">
                            <p className={refundRate === 0 ? "text-red-600" : "text-green-700"}>
                                환불율: <span className="font-bold">{refundRate}%</span>
                            </p>
                            <p className={refundRate === 0 ? "text-red-600" : "text-green-700"}>
                                환불 예정액: <span className="font-bold">{refundAmount.toLocaleString()}원</span>
                            </p>
                        </div>
                        {refundRate === 0 && (
                            <p className="text-xs text-red-500 mt-2">
                                ⚠️ 입실 당일 또는 1일 전 취소는 환불이 불가합니다.
                            </p>
                        )}
                    </div>

                    {/* 환불 계좌 입력 */}
                    <div className="space-y-4">
                        <h4 className="font-bold text-text-1">환불받을 계좌 정보</h4>

                        {/* 은행 선택 */}
                        <div className="relative">
                            <label className="block text-sm text-text-2 mb-1">은행 *</label>
                            <button
                                type="button"
                                onClick={() => setShowBankDropdown(!showBankDropdown)}
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl text-left flex items-center justify-between bg-white"
                            >
                                <span className={selectedBank ? "text-text-1" : "text-text-2"}>
                                    {selectedBank?.name || "은행을 선택하세요"}
                                </span>
                                <ChevronDown size={18} className={`text-text-2 transition-transform ${showBankDropdown ? "rotate-180" : ""}`} />
                            </button>

                            {showBankDropdown && (
                                <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                                    {KOREAN_BANKS.map((bank) => (
                                        <button
                                            key={bank.code}
                                            type="button"
                                            onClick={() => {
                                                setBankCode(bank.code);
                                                setShowBankDropdown(false);
                                            }}
                                            className={`w-full px-4 py-3 text-left hover:bg-gray-50 ${bankCode === bank.code ? "bg-brand-1/10 text-brand-1" : ""}`}
                                        >
                                            {bank.name}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>

                        {/* 직접 입력 (은행명) */}
                        {bankCode === "OTHER" && (
                            <div>
                                <label className="block text-sm text-text-2 mb-1">은행명 직접 입력 *</label>
                                <input
                                    type="text"
                                    value={customBankName}
                                    onChange={(e) => setCustomBankName(e.target.value)}
                                    placeholder="예: 새마을금고 ○○지점"
                                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-1"
                                />
                            </div>
                        )}

                        {/* 계좌번호 */}
                        <div>
                            <label className="block text-sm text-text-2 mb-1">계좌번호 *</label>
                            <input
                                type="text"
                                inputMode="numeric"
                                value={account}
                                onChange={(e) => setAccount(e.target.value.replace(/[^0-9-]/g, ""))}
                                placeholder="'-' 없이 숫자만 입력"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-1"
                            />
                        </div>

                        {/* 예금주 */}
                        <div>
                            <label className="block text-sm text-text-2 mb-1">예금주 *</label>
                            <input
                                type="text"
                                value={holder}
                                onChange={(e) => setHolder(e.target.value)}
                                placeholder="예금주명을 입력하세요"
                                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:border-brand-1"
                            />
                        </div>
                    </div>

                    {/* 취소 사유 (선택) */}
                    <div>
                        <label className="block text-sm text-text-2 mb-2">취소 사유 (선택)</label>
                        <div className="flex flex-wrap gap-2">
                            {CANCEL_REASONS.map((r) => (
                                <button
                                    key={r}
                                    type="button"
                                    onClick={() => setReason(reason === r ? "" : r)}
                                    className={`px-3 py-2 text-sm rounded-full border transition-colors ${reason === r
                                            ? "bg-brand-1 text-white border-brand-1"
                                            : "bg-white text-text-2 border-gray-200 hover:border-brand-1"
                                        }`}
                                >
                                    {r}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 안내 문구 */}
                    <p className="text-xs text-text-2 bg-gray-50 rounded-lg p-3">
                        💡 환불은 관리자 확인 후 1~3 영업일 내에 처리됩니다.
                        계좌 정보를 정확히 입력해주세요.
                    </p>

                    {/* 제출 버튼 */}
                    <button
                        onClick={handleSubmit}
                        disabled={!isValid || loading}
                        className={`w-full py-4 rounded-xl font-bold text-white transition-colors ${isValid && !loading
                                ? "bg-red-500 hover:bg-red-600"
                                : "bg-gray-300 cursor-not-allowed"
                            }`}
                    >
                        {loading ? (
                            <span className="flex items-center justify-center gap-2">
                                <Loader2 size={18} className="animate-spin" />
                                처리 중...
                            </span>
                        ) : (
                            "취소 요청하기"
                        )}
                    </button>
                </div>
            </SheetContent>
        </Sheet>
    );
}
