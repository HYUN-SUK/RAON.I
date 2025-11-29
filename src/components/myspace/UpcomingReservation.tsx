"use client";

import { Calendar, MapPin, User, ChevronRight, Clock, AlertCircle, CheckCircle2, Copy } from "lucide-react";
import { useReservationStore } from "@/store/useReservationStore";
import { format, differenceInDays } from "date-fns";
import { ko } from "date-fns/locale";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function UpcomingReservation() {
    const router = useRouter();
    const { reservations } = useReservationStore();
    const [copied, setCopied] = useState(false);

    // Get the latest reservation
    const latestReservation = reservations.length > 0 ? reservations[reservations.length - 1] : null;

    if (!latestReservation) return null;

    const { status, siteId, checkInDate, checkOutDate, familyCount, visitorCount, vehicleCount } = latestReservation;
    const checkIn = new Date(checkInDate);
    const checkOut = new Date(checkOutDate);

    // Calculate D-Day
    const today = new Date();
    const diffDays = differenceInDays(checkIn, today);
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
                {/* Glow Effect behind card */}
                <div className={`absolute -inset-0.5 bg-gradient-to-r rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500
                    ${status === 'PENDING' ? 'from-yellow-500 to-orange-500' :
                        status === 'CONFIRMED' ? 'from-brand-1 to-brand-2' :
                            'from-red-500 to-pink-500'}`}
                ></div>

                <div className="relative bg-white rounded-3xl overflow-hidden shadow-medium border border-surface-2">
                    {/* Header with Pattern */}
                    <div className={`p-5 relative overflow-hidden transition-colors
                        ${status === 'PENDING' ? 'bg-yellow-600' :
                            status === 'CONFIRMED' ? 'bg-[#1C4526]' :
                                'bg-red-600'}`}
                    >
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:16px_16px]"></div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>

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
                            {siteId === 'site-1' ? '철수네' :
                                siteId === 'site-2' ? '영희네' :
                                    siteId === 'site-3' ? '민수네' : siteId} 캠핑장
                        </h3>
                        <div className="flex items-center text-white/70 text-sm">
                            <MapPin size={14} className="mr-1" />
                            {siteId}
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 bg-surface-1">
                        {status === 'PENDING' ? (
                            <div className="flex flex-col gap-3 mb-5">
                                <div className="p-3 bg-yellow-50 rounded-xl border border-yellow-100">
                                    <div className="flex justify-between items-center mb-1">
                                        <span className="text-xs text-yellow-800 font-medium">입금 계좌 (카카오뱅크)</span>
                                        <button onClick={handleCopyAccount} className="text-xs text-yellow-600 underline flex items-center gap-1">
                                            {copied ? "복사됨" : "복사"} <Copy size={10} />
                                        </button>
                                    </div>
                                    <p className="text-sm font-bold text-yellow-900">3333-00-0000000</p>
                                    <p className="text-[10px] text-yellow-700 mt-1">내일 23:59까지 입금해주세요</p>
                                </div>
                            </div>
                        ) : (
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
                                        가족 {familyCount}, 방문객 {visitorCount}, 차량 {vehicleCount}
                                    </span>
                                </div>
                            </div>
                        )}

                        <div className="flex gap-3">
                            <button className={`flex-1 py-3 text-white rounded-xl text-sm font-bold shadow-lg transition-all flex items-center justify-center gap-1 group/btn
                                ${status === 'PENDING' ? 'bg-yellow-600 hover:bg-yellow-700 shadow-yellow-600/20' :
                                    status === 'CONFIRMED' ? 'bg-brand-1 hover:bg-brand-2 shadow-brand-1/20' :
                                        'bg-gray-500 hover:bg-gray-600'}`}
                            >
                                {status === 'PENDING' ? '예약 확인하기' : '상세보기'}
                                <ChevronRight size={16} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                            {status === 'CONFIRMED' && (
                                <button className="flex-1 py-3 bg-white text-text-1 border border-surface-2 rounded-xl text-sm font-bold hover:bg-surface-1 transition-colors shadow-sm">
                                    길찾기
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
