"use client";

import { Calendar, MapPin, User, ChevronRight, Clock, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { useReservationStore } from "@/store/useReservationStore";
import { format, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";

import { SITES } from "@/constants/sites";

export default function UpcomingReservation() {
    const router = useRouter();
    const { reservations } = useReservationStore();
    const [copied, setCopied] = useState(false);

    // Get the latest reservation
    // In a real app, we would filter by future dates or status
    const latestReservation = reservations.length > 0 ? reservations[reservations.length - 1] : null;

    if (!latestReservation) {
        return (
            <div className="px-6 pb-6">
                <div
                    onClick={() => router.push('/reservation')}
                    className="bg-white rounded-3xl p-6 shadow-sm border border-surface-2 flex flex-col items-center justify-center gap-3 text-center cursor-pointer hover:bg-gray-50 transition-colors"
                >
                    <div className="p-3 bg-brand-1/10 rounded-full text-brand-1">
                        <Calendar size={24} />
                    </div>
                    <div>
                        <h3 className="font-bold text-text-1">아직 예약이 없어요</h3>
                        <p className="text-sm text-text-2">첫 번째 캠핑을 떠나보세요!</p>
                    </div>
                </div>
            </div>
        );
    }

    const { status, siteId, checkInDate, checkOutDate, familyCount, visitorCount, vehicleCount, totalPrice } = latestReservation;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Calculate D-Day
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const checkInDay = new Date(checkIn);
    checkInDay.setHours(0, 0, 0, 0);
    const diffDays = differenceInDays(checkInDay, today);
    const dDay = diffDays === 0 ? "D-Day" : diffDays > 0 ? `D-${diffDays}` : `D+${Math.abs(diffDays)}`;

    const handleCopyAccount = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigator.clipboard.writeText('3333-00-0000000');
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDetailClick = () => {
        router.push('/reservation/complete');
    };

    return (
        <div className="px-6 pb-6">
            <div className="relative group cursor-pointer active:scale-[0.99] transition-transform duration-200" onClick={handleDetailClick}>
                {/* Glow Effect */}
                <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500
                    ${status === 'PENDING' ? 'from-yellow-500 to-orange-500' :
                        status === 'CONFIRMED' ? 'from-brand-1 to-brand-2' :
                            'from-red-500 to-pink-500'}`}
                ></div>

                <div className="relative bg-white rounded-3xl overflow-hidden shadow-medium border border-surface-2">
                    {/* Header */}
                    <div className={`p-5 relative overflow-hidden transition-colors
                        ${status === 'PENDING' ? 'bg-yellow-500' :
                            status === 'CONFIRMED' ? 'bg-[#2F5233]' :
                                'bg-gray-600'}`}
                    >
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:16px_16px]"></div>

                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <span className="inline-flex items-center px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-bold text-white backdrop-blur-sm border border-white/10">
                                {dDay}
                            </span>
                            <span className="flex items-center gap-1 text-xs font-medium text-white/90 tracking-wide">
                                {status === 'PENDING' && <><Clock size={12} /> 입금 대기</>}
                                {status === 'CONFIRMED' && <><CheckCircle2 size={12} /> 예약 확정</>}
                                {status === 'CANCELLED' && <><AlertCircle size={12} /> 취소됨</>}
                            </span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1 tracking-tight">
                            {SITES.find(s => s.id === siteId)?.name || siteId}
                        </h3>
                        <div className="flex items-center text-white/70 text-sm">
                            <MapPin size={14} className="mr-1" />
                            {siteId}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 bg-surface-1">
                        {status === 'PENDING' && (
                            <div className="mb-5 p-4 bg-yellow-50 rounded-2xl border border-yellow-100">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs font-bold text-yellow-800">입금 계좌 (카카오뱅크)</span>
                                    <button onClick={handleCopyAccount} className="text-xs text-yellow-700 underline flex items-center gap-1 hover:text-yellow-900">
                                        {copied ? "복사완료!" : "계좌 복사"} <Copy size={10} />
                                    </button>
                                </div>
                                <p className="text-lg font-bold text-yellow-900 tracking-wider">3333-00-0000000</p>
                                <div className="flex justify-between items-center mt-2 pt-2 border-t border-yellow-200/50">
                                    <span className="text-[10px] text-yellow-700">입금액</span>
                                    <span className="text-sm font-bold text-yellow-900">{totalPrice?.toLocaleString()}원</span>
                                </div>
                            </div>
                        )}

                        <div className="flex flex-col gap-3 mb-5">
                            <div className="flex items-center gap-3 text-sm text-text-2">
                                <div className="p-2 bg-white rounded-full shadow-sm">
                                    <Calendar size={16} className="text-brand-2" />
                                </div>
                                <span className="font-medium">
                                    {format(checkIn, 'yyyy. MM. dd (eee)', { locale: ko })} - {format(checkOut, 'MM. dd (eee)', { locale: ko })}
                                </span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-text-2">
                                <div className="p-2 bg-white rounded-full shadow-sm">
                                    <User size={16} className="text-brand-2" />
                                </div>
                                <span className="font-medium">
                                    가족 {familyCount}, 방문 {visitorCount}, 차량 {vehicleCount}
                                </span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button className={`flex-1 py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-1 group/btn
                                ${status === 'PENDING' ? 'bg-yellow-500 hover:bg-yellow-600 shadow-yellow-500/20' :
                                    status === 'CONFIRMED' ? 'bg-brand-1 hover:bg-brand-2 shadow-brand-1/20' :
                                        'bg-gray-500 hover:bg-gray-600'}`}
                            >
                                {status === 'PENDING' ? '예약 확인하기' : '상세보기'}
                                <ChevronRight size={16} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
