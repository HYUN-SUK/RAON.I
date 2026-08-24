'use client';

import React, { useState } from 'react';
import { Reservation } from '@/types/reservation';
import { useReservationStore } from '@/store/useReservationStore';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CalendarCheck, Phone, Car, Users, Tent, Eye, Clock } from 'lucide-react';





import { format, isSameDay } from 'date-fns';
import { ko } from 'date-fns/locale';

import AdminReservationDetailModal from './AdminReservationDetailModal';

interface TodayCheckInsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function TodayCheckInsModal({ isOpen, onClose }: TodayCheckInsModalProps) {
    const { reservations, sites, fetchAllReservations } = useReservationStore();
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [isDetailOpen, setIsDetailOpen] = useState(false);

    const today = new Date();

    // 오늘 체크인하는 예약 목록 (CANCELLED / REFUNDED 제외)
    const todayCheckInList = reservations
        .filter(r => {
            if (r.status === 'CANCELLED' || r.status === 'REFUNDED') return false;
            const checkInDate = new Date(r.checkInDate);
            return isSameDay(checkInDate, today);
        })
        .sort((a, b) => (a.siteId || '').localeCompare(b.siteId || ''));

    // 오늘 체류 중인 전체 팀 (연박 포함)
    const todayStayingList = reservations
        .filter(r => {
            if (r.status === 'CANCELLED' || r.status === 'REFUNDED') return false;
            const checkIn = new Date(r.checkInDate).getTime();
            const checkOut = new Date(r.checkOutDate).getTime();
            const now = today.getTime();
            return checkIn <= now && checkOut > now && !isSameDay(new Date(r.checkInDate), today);
        })
        .sort((a, b) => (a.siteId || '').localeCompare(b.siteId || ''));

    const handleRowClick = (r: Reservation) => {
        setSelectedReservation(r);
        setIsDetailOpen(true);
    };

    return (
        <>
            <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
                <DialogContent className="max-w-4xl max-h-[85vh] flex flex-col p-6">
                    <DialogHeader className="border-b border-stone-100 pb-3">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pr-6">
                            <div>
                                <DialogTitle className="text-xl font-bold text-stone-900 flex items-center gap-2">
                                    <CalendarCheck className="w-5 h-5 text-blue-600" />
                                    오늘 입실 현황 ({format(today, 'yyyy년 M월 d일 eeee', { locale: ko })})
                                </DialogTitle>
                                <DialogDescription className="text-xs text-stone-500 mt-0.5">
                                    오늘 새로 체크인하는 예약팀 및 현재 캠핑장 체류 현황을 한눈에 확인합니다.
                                </DialogDescription>
                            </div>
                            <div className="flex items-center gap-2">
                                <Badge className="bg-blue-50 text-blue-700 border-blue-200 text-xs px-2.5 py-1 font-bold">
                                    오늘 신규 입실 {todayCheckInList.length}팀
                                </Badge>
                                <Badge className="bg-emerald-50 text-emerald-700 border-emerald-200 text-xs px-2.5 py-1 font-bold">
                                    연박 체류 {todayStayingList.length}팀
                                </Badge>
                            </div>
                        </div>
                    </DialogHeader>

                    {/* Content Body */}
                    <div className="flex-1 overflow-y-auto space-y-6 pt-3 pr-1">
                        {/* 1. 오늘 신규 체크인 팀 */}
                        <div>
                            <div className="flex items-center justify-between mb-2.5">
                                <h3 className="text-sm font-bold text-stone-800 flex items-center gap-1.5">
                                    <Tent className="w-4 h-4 text-emerald-700" />
                                    오늘 입실 예정 팀 ({todayCheckInList.length}팀)
                                </h3>
                                <span className="text-xs text-stone-400">행을 클릭하면 상세/관리 창이 열립니다.</span>
                            </div>

                            {todayCheckInList.length === 0 ? (
                                <div className="bg-stone-50 rounded-2xl p-8 text-center border border-dashed border-stone-200">
                                    <p className="text-sm text-stone-500 font-medium">오늘 새로 입실 예정인 예약팀이 없습니다.</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-stone-200 overflow-hidden shadow-2xs">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-stone-50 text-stone-600 font-bold border-b border-stone-200">
                                            <tr>
                                                <th className="py-3 px-3.5">사이트</th>
                                                <th className="py-3 px-3.5">상태</th>
                                                <th className="py-3 px-3.5">예약자 / 연락처</th>
                                                <th className="py-3 px-3.5">인원 / 차량</th>
                                                <th className="py-3 px-3.5">숙박 일정</th>
                                                <th className="py-3 px-3.5">고객 메모</th>
                                                <th className="py-3 px-3.5 text-right">상세</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100 text-stone-700">
                                            {todayCheckInList.map(r => {
                                                const site = sites.find(s => s.id === r.siteId);
                                                const siteName = site?.name || r.siteId;
                                                const checkIn = new Date(r.checkInDate);
                                                const checkOut = new Date(r.checkOutDate);
                                                const nights = Math.ceil((checkOut.getTime() - checkIn.getTime()) / (1000 * 60 * 60 * 24));

                                                return (
                                                    <tr 
                                                        key={r.id} 
                                                        onClick={() => handleRowClick(r)}
                                                        className="hover:bg-blue-50/50 cursor-pointer transition-colors"
                                                    >
                                                        <td className="py-3 px-3.5 font-bold text-emerald-900 text-sm">
                                                            {siteName}
                                                        </td>
                                                        <td className="py-3 px-3.5">
                                                            {r.status === 'CONFIRMED' ? (
                                                                <Badge className="bg-emerald-100 text-emerald-800 border-none text-[11px] font-bold">
                                                                    확정됨
                                                                </Badge>
                                                            ) : (
                                                                <Badge className="bg-amber-100 text-amber-900 border-none text-[11px] font-bold">
                                                                    입금대기
                                                                </Badge>
                                                            )}
                                                        </td>
                                                        <td className="py-3 px-3.5">
                                                            <div className="font-extrabold text-stone-900 text-sm">{r.guestName || '-'}</div>
                                                            <div className="text-stone-500 flex items-center gap-1 mt-0.5">
                                                                <Phone className="w-3 h-3 text-stone-400" />
                                                                {r.guestPhone || '-'}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3.5">
                                                            <div className="font-semibold text-stone-800">{r.familyCount || 1}가족 ({r.guests}명)</div>
                                                            <div className="text-stone-500 text-[11px] flex items-center gap-1 mt-0.5">
                                                                <Car className="w-3 h-3 text-stone-400" />
                                                                {r.vehicleNumber ? r.vehicleNumber : `${r.vehicleCount || 1}대`}
                                                            </div>
                                                        </td>
                                                        <td className="py-3 px-3.5">
                                                            <span className="font-bold text-stone-800">{nights}박</span>
                                                            <span className="text-stone-400 ml-1">
                                                                (~{format(checkOut, 'MM.dd')})
                                                            </span>
                                                        </td>
                                                        <td className="py-3 px-3.5 max-w-[160px] truncate text-stone-500">
                                                            {r.requests || '-'}
                                                        </td>
                                                        <td className="py-3 px-3.5 text-right">
                                                            <Button size="sm" variant="ghost" className="h-7 px-2 text-blue-600 hover:text-blue-800">
                                                                <Eye className="w-3.5 h-3.5 mr-1" /> 확인
                                                            </Button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            )}
                        </div>

                        {/* 2. 기존 연박 체류 중인 팀 */}
                        {todayStayingList.length > 0 && (
                            <div className="pt-3 border-t border-stone-200">
                                <h3 className="text-sm font-bold text-stone-800 flex items-center gap-1.5 mb-2.5">
                                    <Clock className="w-4 h-4 text-blue-600" />
                                    연박 체류 중인 팀 ({todayStayingList.length}팀)
                                </h3>
                                <div className="bg-stone-50/60 rounded-2xl border border-stone-200 overflow-hidden">
                                    <table className="w-full text-left text-xs">
                                        <thead className="bg-stone-100/70 text-stone-500 font-bold border-b border-stone-200">
                                            <tr>
                                                <th className="py-2.5 px-3.5">사이트</th>
                                                <th className="py-2.5 px-3.5">예약자</th>
                                                <th className="py-2.5 px-3.5">연락처</th>
                                                <th className="py-2.5 px-3.5">인원</th>
                                                <th className="py-2.5 px-3.5">퇴실 예정일</th>
                                            </tr>
                                        </thead>
                                        <tbody className="divide-y divide-stone-100 text-stone-700">
                                            {todayStayingList.map(r => {
                                                const site = sites.find(s => s.id === r.siteId);
                                                const siteName = site?.name || r.siteId;
                                                const checkOut = new Date(r.checkOutDate);

                                                return (
                                                    <tr 
                                                        key={r.id}
                                                        onClick={() => handleRowClick(r)}
                                                        className="hover:bg-stone-100/60 cursor-pointer transition-colors"
                                                    >
                                                        <td className="py-2.5 px-3.5 font-bold text-stone-900">{siteName}</td>
                                                        <td className="py-2.5 px-3.5 font-semibold">{r.guestName}</td>
                                                        <td className="py-2.5 px-3.5 text-stone-500">{r.guestPhone || '-'}</td>
                                                        <td className="py-2.5 px-3.5">{r.guests}명</td>
                                                        <td className="py-2.5 px-3.5 font-bold text-stone-800">
                                                            {format(checkOut, 'yyyy.MM.dd(eee)', { locale: ko })} 퇴실
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="pt-3 border-t border-stone-100 flex justify-end">
                        <Button onClick={onClose} className="bg-[#224732] hover:bg-[#1b3827] text-white font-bold text-xs rounded-xl px-5">
                            닫기
                        </Button>
                    </div>
                </DialogContent>
            </Dialog>

            {/* 상세 관리 모달 */}
            <AdminReservationDetailModal
                reservation={selectedReservation}
                isOpen={isDetailOpen}
                onClose={() => setIsDetailOpen(false)}
                onStatusChanged={() => {
                    fetchAllReservations();
                }}
            />
        </>
    );
}
