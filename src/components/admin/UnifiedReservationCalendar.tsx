'use client';

import React, { useState, useEffect } from 'react';
import {
    format, startOfMonth, endOfMonth, startOfWeek, endOfWeek,
    eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths, isToday, addDays, isWithinInterval, differenceInDays, startOfDay
} from 'date-fns';
import { ko } from 'date-fns/locale';
import { ChevronLeft, ChevronRight, Ban, CheckCircle, Clock, XCircle, Info, User, Phone, Search, Trash2, Edit2, Calendar, History } from 'lucide-react';
import { useReservationStore } from '@/store/useReservationStore';
import { SITES } from '@/constants/sites';
import { Reservation, BlockedDate } from '@/types/reservation';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

export default function UnifiedReservationCalendar() {
    const {
        reservations, blockedDates, fetchBlockedDates,
        addBlockDate, removeBlockDate, toggleBlockPaid, getUserHistory,
        fetchHolidays, holidays // Added holidays
    } = useReservationStore();

    const [currentDate, setCurrentDate] = useState(new Date());

    // Modal State
    const [viewMode, setViewMode] = useState<'BLOCK' | 'DETAIL' | 'DAILY' | 'DELETE_CONFIRM' | null>(null);
    const [selectedDate, setSelectedDate] = useState<Date | null>(null);
    const [selectedSiteId, setSelectedSiteId] = useState<string | null>(null);

    // Data State
    const [selectedReservation, setSelectedReservation] = useState<Reservation | null>(null);
    const [selectedBlock, setSelectedBlock] = useState<BlockedDate | null>(null);
    const [userHistory, setUserHistory] = useState<Reservation[]>([]);
    const [showHistory, setShowHistory] = useState(false);

    // Form State
    const [blockMemo, setBlockMemo] = useState('');
    const [blockDuration, setBlockDuration] = useState('1');
    const [guestName, setGuestName] = useState('');
    const [contact, setContact] = useState('');
    const [isPaid, setIsPaid] = useState(false);
    const [maxDuration, setMaxDuration] = useState(30);

    useEffect(() => {
        fetchBlockedDates();
        fetchHolidays(); // Fetch holidays
    }, []);

    // Calendar Calculations
    const monthStart = startOfMonth(currentDate);
    const monthEnd = endOfMonth(monthStart);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(monthEnd);
    const calendarDays = eachDayOfInterval({ start: startDate, end: endDate });

    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));
    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const today = () => setCurrentDate(new Date());

    // --- Logic: Smart Blocking ---
    const calculateMaxDuration = (start: Date, siteId: string) => {
        // Find next occupancy for this site after start date
        const nextOccupancy = [...reservations, ...blockedDates]
            .filter(item => {
                const itemStart = (item as Reservation).checkInDate ? new Date((item as Reservation).checkInDate) : new Date((item as BlockedDate).startDate);
                if ((item as BlockedDate).siteId && (item as BlockedDate).siteId !== 'ALL' && (item as BlockedDate).siteId !== siteId) return false;
                if ((item as Reservation).siteId && (item as Reservation).siteId !== siteId) return false;
                return itemStart > start;
            })
            .sort((a, b) => {
                const startA = (a as Reservation).checkInDate ? new Date((a as Reservation).checkInDate).getTime() : new Date((a as BlockedDate).startDate).getTime();
                const startB = (b as Reservation).checkInDate ? new Date((b as Reservation).checkInDate).getTime() : new Date((b as BlockedDate).startDate).getTime();
                return startA - startB;
            })[0];

        const monthEnd = endOfMonth(start);
        let limitDate = monthEnd;

        if (nextOccupancy) {
            const nextStart = (nextOccupancy as Reservation).checkInDate ? new Date((nextOccupancy as Reservation).checkInDate) : new Date((nextOccupancy as BlockedDate).startDate);
            // Limit is the day BEFORE next start
            const dayBeforeNext = addDays(nextStart, -1);
            limitDate = nextStart; // Upper bound (exclusive for stay night count)
            return differenceInDays(limitDate, start);
        } else {
            // User requirement: "If no reservation, 4~31 dropdown".
            return differenceInDays(addDays(monthEnd, 1), start);
        }
    };

    const getStatusForSite = (date: Date, siteId: string) => {
        const checkTime = startOfDay(date).getTime();

        // Check Web Reservation
        const reservation = reservations.find(r =>
            r.siteId === siteId &&
            r.status !== 'CANCELLED' &&
            startOfDay(new Date(r.checkInDate)).getTime() <= checkTime &&
            startOfDay(new Date(r.checkOutDate)).getTime() > checkTime
        );
        if (reservation) return { type: 'RESERVED', data: reservation };

        // Check Blocked
        const blocked = blockedDates.find(b =>
            (b.siteId === 'ALL' || b.siteId === siteId) &&
            startOfDay(new Date(b.startDate)).getTime() <= checkTime &&
            startOfDay(new Date(b.endDate)).getTime() > checkTime
        );
        if (blocked) return { type: 'BLOCKED', data: blocked };

        return null;
    };

    const handleCellClick = (date: Date, siteId: string, status: any) => {
        setSelectedDate(date);
        setSelectedSiteId(siteId);

        if (status?.type === 'RESERVED') {
            setSelectedReservation(status.data);
            setSelectedBlock(null);
            setShowHistory(false);
            setViewMode('DETAIL');
        } else if (status?.type === 'BLOCKED') {
            setSelectedBlock(status.data);
            setSelectedReservation(null);
            setShowHistory(false);
            setViewMode('DETAIL');
        } else {
            // New Block
            setBlockMemo('');
            setGuestName('');
            setContact('');
            setIsPaid(false);

            // Calc Max Duration
            const max = calculateMaxDuration(date, siteId);
            setMaxDuration(Math.max(1, max)); // Ensure at least 1
            setBlockDuration('1');

            setViewMode('BLOCK');
            setSelectedBlock(null);
            setSelectedReservation(null);
        }
    };

    const confirmBlock = async () => {
        if (!selectedDate || !selectedSiteId) return;
        const start = selectedDate;
        const end = addDays(start, parseInt(blockDuration));
        const newBlock = { id: '', siteId: selectedSiteId, startDate: start, endDate: end, memo: blockMemo, isPaid, guestName, contact };
        await addBlockDate(newBlock);
        toast.success('차단(예약)이 설정되었습니다.');
        setViewMode(null);
    };

    const handleDeleteClick = () => {
        setViewMode('DELETE_CONFIRM');
    };

    const confirmDelete = async () => {
        if (selectedBlock) {
            await removeBlockDate(selectedBlock.id);
            toast.success('삭제되었습니다.');
            setViewMode(null);
        }
    };

    // Customer History
    const loadUserHistory = async () => {
        if (selectedReservation) {
            const history = await getUserHistory(selectedReservation.userId); // Web User ID
            setUserHistory(history);
            setShowHistory(true);
        } else if (selectedBlock && selectedBlock.guestName) {
            const history = await getUserHistory(selectedBlock.guestName);
            setUserHistory(history);
            setShowHistory(true);
        }
    };

    return (
        <div className="space-y-4">
            {/* Header Controls */}
            <div className="flex items-center justify-between bg-white p-4 rounded-xl border shadow-sm">
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-bold">{format(currentDate, 'yyyy년 M월', { locale: ko })}</h2>
                    <div className="flex gap-1">
                        <Button variant="outline" size="icon" onClick={prevMonth}><ChevronLeft className="w-4 h-4" /></Button>
                        <Button variant="outline" size="icon" onClick={nextMonth}><ChevronRight className="w-4 h-4" /></Button>
                        <Button variant="ghost" onClick={today}>오늘</Button>
                    </div>
                </div>
                <div className="flex items-center gap-4 text-xs font-medium flex-wrap">
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-500"></span>웹 확정</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-yellow-400"></span>웹 대기</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500"></span>차단(입금)</div>
                    <div className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-500"></span>차단(미입금)</div>
                </div>
            </div>

            {/* Calendar Grid */}
            <div className="bg-white rounded-xl border shadow-sm p-1">
                <div className="grid grid-cols-7 border-b bg-gray-50 text-center py-2 text-sm font-bold text-gray-600">
                    <div className="text-red-500">일</div><div>월</div><div>화</div><div>수</div><div>목</div><div>금</div><div className="text-blue-500">토</div>
                </div>
                <div className="grid grid-cols-7 auto-rows-fr divide-x divide-y">
                    {calendarDays.map((day, idx) => {
                        const isCurrentMonth = isSameMonth(day, monthStart);
                        const isTodayDate = isToday(day);
                        const dateKey = format(day, 'yyyy-MM-dd');
                        const isHoliday = holidays.has(dateKey);
                        const isSunday = day.getDay() === 0;
                        const isPast = day < startOfDay(new Date()) && !isTodayDate; // strictly past

                        return (
                            <div key={idx} className={`min-h-[140px] px-1 py-2 flex flex-col gap-1 ${isCurrentMonth ? 'bg-white' : 'bg-gray-50/50'} ${isPast ? 'opacity-50 grayscale-[0.5]' : ''}`}>
                                <div className="flex justify-between items-center px-1 mb-1">
                                    <span
                                        onClick={(e) => { e.stopPropagation(); setSelectedDate(day); setViewMode('DAILY'); }}
                                        className={`text-sm font-bold cursor-pointer hover:bg-gray-100 px-1.5 rounded transition-colors
                                            ${!isCurrentMonth ? 'text-gray-300' :
                                                isTodayDate ? 'text-white bg-blue-600 hover:bg-blue-700' :
                                                    (isHoliday || isSunday) ? 'text-red-500' : 'text-gray-700'
                                            }`}
                                    >
                                        {format(day, 'd')}
                                        {isHoliday && <span className="text-[10px] ml-1 font-normal text-red-400 block sm:inline sm:ml-1">휴일</span>}
                                    </span>
                                </div>
                                <div className="flex-1 flex flex-col gap-1">
                                    {SITES.map(site => {
                                        const status = getStatusForSite(day, site.id);
                                        return (
                                            <div key={site.id} onClick={(e) => { e.stopPropagation(); handleCellClick(day, site.id, status); }}
                                                className={`
                                                    text-[10px] px-1.5 py-0.5 rounded cursor-pointer border flex justify-between items-center group
                                                    ${status?.type === 'RESERVED'
                                                        ? ((status.data as Reservation).status === 'CONFIRMED' ? 'bg-green-100 text-green-800 border-green-200' : 'bg-yellow-50 text-yellow-800 border-yellow-200')
                                                        : status?.type === 'BLOCKED'
                                                            ? ((status.data as BlockedDate).isPaid ? 'bg-blue-50 text-blue-700 border-blue-200' : 'bg-red-50 text-red-600 border-red-100')
                                                            : 'bg-white border-transparent hover:border-blue-200 hover:bg-gray-50'
                                                    }
                                                `}
                                            >
                                                <span className={`${!status ? 'text-gray-600 font-bold' : 'font-bold'} truncate max-w-[40px]`}>{site.name}</span>
                                                {status?.type === 'BLOCKED' && (status.data as BlockedDate).guestName && (
                                                    <span className="truncate max-w-[50px] font-bold">{(status.data as BlockedDate).guestName}</span>
                                                )}
                                                {status?.type === 'RESERVED' && (
                                                    <span className="truncate font-bold hidden group-hover:inline">{(status.data as Reservation).guests}인</span>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Block Modal with Smart Duration */}
            <Dialog open={viewMode === 'BLOCK'} onOpenChange={(o) => !o && setViewMode(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>차단 / 예약 설정</DialogTitle>
                        <DialogDescription>{selectedDate && format(selectedDate, 'yyyy-MM-dd')} / {SITES.find(s => s.id === selectedSiteId)?.name}</DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4 py-2">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label>기간 ({maxDuration}박 가능)</Label>
                                <Select value={blockDuration} onValueChange={setBlockDuration}>
                                    <SelectTrigger><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                        {Array.from({ length: maxDuration }, (_, i) => i + 1).map(n => (
                                            <SelectItem key={n} value={n.toString()}>{n}박 ({n + 1}일)</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="space-y-2">
                                <Label>입금 여부</Label>
                                <div className="flex items-center space-x-2 pt-2">
                                    <Switch checked={isPaid} onCheckedChange={setIsPaid} id="paid-mode" />
                                    <Label htmlFor="paid-mode" className={isPaid ? 'text-blue-600 font-bold' : 'text-gray-500'}>
                                        {isPaid ? '입금 확인 (예약)' : '미입금 (차단)'}
                                    </Label>
                                </div>
                            </div>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2"><Label>고객명</Label><Input value={guestName} onChange={e => setGuestName(e.target.value)} placeholder="홍길동" /></div>
                            <div className="space-y-2"><Label>연락처(선택)</Label><Input value={contact} onChange={e => setContact(e.target.value)} placeholder="010-0000-0000" /></div>
                        </div>
                        <div className="space-y-2"><Label>메모</Label><Textarea value={blockMemo} onChange={e => setBlockMemo(e.target.value)} placeholder="사유 입력" /></div>
                    </div>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewMode(null)}>취소</Button>
                        <Button className={isPaid ? 'bg-blue-600' : 'bg-red-600'} onClick={confirmBlock}>{isPaid ? '등록' : '차단'}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Detail Modal with Customer History */}
            <Dialog open={viewMode === 'DETAIL'} onOpenChange={(o) => !o && setViewMode(null)}>
                <DialogContent className="max-w-xl">
                    <DialogHeader><DialogTitle>상세 정보</DialogTitle></DialogHeader>
                    <div className="grid md:grid-cols-2 gap-6">
                        {/* Info Section */}
                        <div className="space-y-4">
                            {selectedReservation && (
                                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                                    <div><Label className="text-xs text-gray-500">예약자</Label>
                                        <p className="font-bold text-lg cursor-pointer hover:text-blue-600 underline decoration-dotted" onClick={loadUserHistory}>{selectedReservation.userId}</p></div>
                                    <div className="grid grid-cols-2 gap-2">
                                        <div><Label className="text-xs text-gray-500">상태</Label><p className="font-bold">{selectedReservation.status}</p></div>
                                        <div><Label className="text-xs text-gray-500">인원</Label><p>{selectedReservation.guests}명</p></div>
                                    </div>
                                    <div><Label className="text-xs text-gray-500">요청사항</Label><p className="text-sm">{selectedReservation.requests || '-'}</p></div>
                                </div>
                            )}
                            {selectedBlock && (
                                <div className="space-y-3 bg-gray-50 p-4 rounded-lg">
                                    <div className="flex justify-between">
                                        <div><Label className="text-xs text-gray-500">고객명</Label>
                                            <p className="font-bold text-lg cursor-pointer hover:text-blue-600 underline decoration-dotted" onClick={loadUserHistory}>{selectedBlock.guestName || '(이름없음)'}</p></div>
                                        <span className={`px-2 py-1 rounded h-fit text-xs font-bold ${selectedBlock.isPaid ? 'bg-blue-100 text-blue-700' : 'bg-red-100 text-red-700'}`}>{selectedBlock.isPaid ? '입금완료' : '미입금'}</span>
                                    </div>
                                    <div className="text-sm"><Phone className="w-3 h-3 inline mr-1" /> {selectedBlock.contact || '-'}</div>
                                    <div className="text-sm"><Clock className="w-3 h-3 inline mr-1" /> {format(new Date(selectedBlock.startDate), 'yyyy-MM-dd')} ~ {format(new Date(selectedBlock.endDate), 'MM.dd')}</div>
                                    <div className="bg-white p-2 rounded text-sm text-gray-600 mt-2 border">{selectedBlock.memo}</div>

                                    {/* Action Buttons for Block */}
                                    {selectedBlock && (
                                        <div className="flex gap-2 mt-4 pt-2 border-t">
                                            <Button variant="outline" size="sm" className="flex-1" onClick={async () => { if (selectedBlock && toggleBlockPaid) { await toggleBlockPaid(selectedBlock.id); toast.success('변경됨'); setSelectedBlock({ ...selectedBlock, isPaid: !selectedBlock.isPaid }); } }}>
                                                입금상태 변경
                                            </Button>
                                            <Button variant="destructive" size="sm" className="flex-1" onClick={handleDeleteClick}>
                                                <Trash2 className="w-4 h-4 mr-1" /> 삭제
                                            </Button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* History Section (Visible on click) */}
                        <div className={`border-l pl-6 ${!showHistory ? 'hidden' : 'block'}`}>
                            <h3 className="font-bold mb-3 flex items-center gap-2"><History className="w-4 h-4" /> 과거 이력</h3>
                            <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                                {userHistory.length === 0 ? <p className="text-sm text-gray-400">이력이 없습니다.</p> : userHistory.map(h => (
                                    <div key={h.id} className="text-xs border p-2 rounded bg-white">
                                        <div className="flex justify-between font-bold mb-1">
                                            <span>{format(new Date(h.checkInDate), 'yy.MM.dd')}</span>
                                            <span className={h.status === 'CONFIRMED' ? 'text-green-600' : 'text-gray-500'}>{h.status}</span>
                                        </div>
                                        <div>{SITES.find(s => s.id === h.siteId)?.name} / {h.guests}명</div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                    <DialogFooter><Button onClick={() => setViewMode(null)}>닫기</Button></DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Enhanced Daily View (List) */}
            <Dialog open={viewMode === 'DAILY'} onOpenChange={(o) => !o && setViewMode(null)}>
                <DialogContent className="max-w-2xl h-[80vh] flex flex-col">
                    <DialogHeader><DialogTitle>{selectedDate && format(selectedDate, 'yyyy년 M월 d일 (eee)', { locale: ko })} 예약 현황</DialogTitle></DialogHeader>
                    <div className="flex-1 overflow-auto">
                        <table className="w-full text-sm text-left">
                            <thead className="text-xs text-gray-500 bg-gray-50 uppercase sticky top-0">
                                <tr>
                                    <th className="px-4 py-3">사이트</th>
                                    <th className="px-4 py-3">상태</th>
                                    <th className="px-4 py-3">고객명/연락처</th>
                                    <th className="px-4 py-3">인원/기간</th>
                                    <th className="px-4 py-3">메모</th>
                                    <th className="px-4 py-3 text-right">관리</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y text-gray-700">
                                {selectedDate && SITES.map(site => {
                                    const status = getStatusForSite(selectedDate, site.id);
                                    return (
                                        <tr key={site.id} className="hover:bg-gray-50">
                                            <td className="px-4 py-3 font-bold">{site.name}</td>
                                            <td className="px-4 py-3">
                                                {status?.type === 'RESERVED' && <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full font-bold">확정</span>}
                                                {status?.type === 'BLOCKED' && (status.data as BlockedDate).isPaid && <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full font-bold">입금</span>}
                                                {status?.type === 'BLOCKED' && !(status.data as BlockedDate).isPaid && <span className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full font-bold">미입금</span>}
                                                {!status && <span className="text-gray-400 text-xs">가능</span>}
                                            </td>
                                            <td className="px-4 py-3">
                                                {status?.type === 'RESERVED' ? (status.data as Reservation).userId :
                                                    status?.type === 'BLOCKED' ? (
                                                        <div>
                                                            <div className="font-bold">{(status.data as BlockedDate).guestName || '-'}</div>
                                                            <div className="text-xs text-gray-500">{(status.data as BlockedDate).contact}</div>
                                                        </div>
                                                    ) : '-'}
                                            </td>
                                            <td className="px-4 py-3">
                                                {status?.type === 'RESERVED' ? `${(status.data as Reservation).guests}명` :
                                                    status?.type === 'BLOCKED' ? (
                                                        <span className="text-xs">{format(new Date((status.data as BlockedDate).startDate), 'MM/dd')}~{format(new Date((status.data as BlockedDate).endDate), 'MM/dd')}</span>
                                                    ) : '-'}
                                            </td>
                                            <td className="px-4 py-3 text-gray-500 truncate max-w-[150px]">
                                                {status?.type === 'RESERVED' ? (status.data as Reservation).requests : (status?.data as BlockedDate)?.memo}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                <Button size="sm" variant="ghost" onClick={() => handleCellClick(selectedDate, site.id, status)}>
                                                    <Edit2 className="w-4 h-4 text-gray-400 hover:text-blue-600" />
                                                </Button>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </DialogContent>
            </Dialog>

            {/* Delete Confirmation Dialog */}
            <Dialog open={viewMode === 'DELETE_CONFIRM'} onOpenChange={(o) => !o && setViewMode('DETAIL')}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>차단 해제 및 삭제</DialogTitle>
                        <DialogDescription>
                            정말로 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setViewMode('DETAIL')}>취소</Button>
                        <Button variant="destructive" onClick={confirmDelete}>삭제하기</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
}
