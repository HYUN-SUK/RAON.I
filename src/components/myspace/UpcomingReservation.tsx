"use client";

import { Calendar, MapPin, User, ChevronRight } from "lucide-react";

export default function UpcomingReservation() {
    return (
        <div className="px-6 pb-6">
            <div className="relative group cursor-pointer active:scale-[0.99] transition-transform duration-200">
                {/* Glow Effect behind card */}
                <div className="absolute -inset-0.5 bg-gradient-to-r from-brand-1 to-brand-2 rounded-3xl blur opacity-30 group-hover:opacity-50 transition duration-500"></div>

                <div className="relative bg-white rounded-3xl overflow-hidden shadow-medium border border-surface-2">
                    {/* Header with Pattern */}
                    <div className="bg-[#1C4526] p-5 relative overflow-hidden">
                        <div className="absolute inset-0 opacity-10 bg-[radial-gradient(circle_at_1px_1px,#fff_1px,transparent_0)] [background-size:16px_16px]"></div>
                        <div className="absolute top-0 right-0 w-32 h-32 bg-white/5 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>

                        <div className="flex justify-between items-start mb-3 relative z-10">
                            <span className="inline-flex items-center px-2.5 py-1 bg-white/20 rounded-full text-[10px] font-bold text-white backdrop-blur-sm border border-white/10">
                                D-3
                            </span>
                            <span className="text-xs font-medium text-white/80 tracking-wide">예약 확정</span>
                        </div>

                        <h3 className="text-xl font-bold text-white mb-1 tracking-tight">철수네 캠핑장</h3>
                        <div className="flex items-center text-white/70 text-sm">
                            <MapPin size={14} className="mr-1" />
                            A구역 3번 사이트
                        </div>
                    </div>

                    {/* Body */}
                    <div className="p-5 bg-surface-1">
                        <div className="flex flex-col gap-3 mb-5">
                            <div className="flex items-center gap-3 text-sm text-text-2">
                                <div className="p-2 bg-white rounded-full shadow-sm">
                                    <Calendar size={16} className="text-brand-2" />
                                </div>
                                <span className="font-medium">2025. 11. 30 (토) - 12. 01 (일)</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-text-2">
                                <div className="p-2 bg-white rounded-full shadow-sm">
                                    <User size={16} className="text-brand-2" />
                                </div>
                                <span className="font-medium">성인 2명, 차량 1대</span>
                            </div>
                        </div>

                        <div className="flex gap-3">
                            <button className="flex-1 py-3 bg-brand-1 text-white rounded-xl text-sm font-bold shadow-lg shadow-brand-1/20 hover:bg-brand-2 transition-all flex items-center justify-center gap-1 group/btn">
                                상세보기
                                <ChevronRight size={16} className="opacity-70 group-hover/btn:translate-x-1 transition-transform" />
                            </button>
                            <button className="flex-1 py-3 bg-white text-text-1 border border-surface-2 rounded-xl text-sm font-bold hover:bg-surface-1 transition-colors shadow-sm">
                                길찾기
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
