'use client';

import { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Plus,
    Calendar,
    CheckCircle2,
    XCircle,
    Tent,
    ChevronLeft,
    Loader2
} from 'lucide-react';
import { Schedule, getMySchedules, deleteSchedule, completeSchedule } from '@/actions/schedule';
import ScheduleCard from '@/components/schedule/ScheduleCard';
import { useReservationStore } from '@/store/useReservationStore';
import { Reservation } from '@/types/reservation';
import { SITES } from '@/constants/sites';
import dynamic from 'next/dynamic';

const ScheduleForm = dynamic(() => import('@/components/schedule/ScheduleForm'), {
    ssr: false,
    loading: () => (
        <div className="p-8 flex items-center justify-center">
            <Loader2 className="w-6 h-6 animate-spin text-[#388E5A]" />
        </div>
    )
});

const CancelReservationSheet = dynamic(() => import('@/components/reservation/CancelReservationSheet'), {
    ssr: false
});
import {
    Sheet,
    SheetContent,
    SheetHeader,
    SheetTitle,
} from '@/components/ui/sheet';
import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

type TabType = 'scheduled' | 'completed' | 'cancelled';

function ScheduleContent() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [isMounted, setIsMounted] = useState(false);
    const [activeTab, setActiveTab] = useState<TabType>('scheduled');
    
    // [v14.3.0] 0초 즉시 렌더링 SWR 캐시: 기존 로컬 캐시에서 즉각 복원하여 첫 진입 대기시간 0ms 달성
    const [allSchedules, setAllSchedules] = useState<Schedule[]>(() => {
        if (typeof window === 'undefined') return [];
        try {
            const raw = localStorage.getItem('user_schedules_cache');
            if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list)) return list as Schedule[];
            }
        } catch {}
        return [];
    });

    const [isLoading, setIsLoading] = useState<boolean>(() => {
        if (typeof window === 'undefined') return true;
        try {
            const raw = localStorage.getItem('user_schedules_cache');
            if (raw) {
                const list = JSON.parse(raw);
                if (Array.isArray(list) && list.length > 0) return false;
            }
        } catch {}
        return true;
    });

    const [isFormOpen, setIsFormOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    useEffect(() => {
        setIsMounted(true);
        // 나의 여행일정 페이지에 진입한 이상 언제 복귀하더라도 홈 아코디언이 펼쳐지도록 세션 플래그 보장
        try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}

        const handlePopState = () => {
            try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}
        };
        window.addEventListener('popstate', handlePopState);
        return () => window.removeEventListener('popstate', handlePopState);
    }, []);

    // 예약 취소 연동용 스토어 및 상태
    const { reservations, fetchMyReservations, updateReservationStatus } = useReservationStore();
    const [cancelTarget, setCancelTarget] = useState<Reservation | null>(null);
    const [cancelSheetOpen, setCancelSheetOpen] = useState(false);
    const [pendingCancelConfirmOpen, setPendingCancelConfirmOpen] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    // [v11.9.70] 홈 화면 등에서 '일정추가' 파라미터 전달 시 자동 오픈
    useEffect(() => {
        if (searchParams.get('add') === 'external') {
            setIsFormOpen(true);
        }
    }, [searchParams]);

    // 전체 일정 및 예약 통합 로드 (SWR 캐시 패턴: 캐시 존재 시 화면 차단 없이 백그라운드 조용히 갱신)
    const loadData = useCallback(async (isInitial = false) => {
        // 캐시 데이터가 아예 없는 경우에만 스켈레톤 로더 노출
        if (isInitial && allSchedules.length === 0) {
            setIsLoading(true);
        }
        try {
            const [schedulesData] = await Promise.all([
                getMySchedules(),
                fetchMyReservations()
            ]);
            if (schedulesData) {
                setAllSchedules(schedulesData);
                try {
                    localStorage.setItem('user_schedules_cache', JSON.stringify(schedulesData));
                } catch {}
            }
        } catch (error) {
            console.error('Fetch schedules error:', error);
            toast.error('일정을 불러오는데 실패했어요');
        } finally {
            setIsLoading(false);
        }
    }, [allSchedules.length, fetchMyReservations]);

    useEffect(() => {
        loadData(true);
    }, [loadData]);

    // [v12.0.0] 탭 전환 시 네트워크 재호출 없이 0ms 즉시 메모리 필터링 (스피너 깜빡임 100% 제거)
    const schedules = useMemo(() => {
        if (activeTab === 'scheduled') {
            const todayStr = new Date().toISOString().split('T')[0];

            // PENDING 상태인 예약들을 Schedule 포맷으로 변환
            const pendingReservations = reservations
                .filter(r => r.status === 'PENDING' && new Date(r.checkOutDate) >= new Date(todayStr))
                .map(r => {
                    const siteName = SITES.find(s => s.id === r.siteId)?.name || r.siteId;
                    return {
                        id: r.id,
                        reservation_id: r.id,
                        user_id: r.userId,
                        campground_name: `라온아이 (${siteName})`,
                        campground_address: r.siteId,
                        check_in: r.checkInDate instanceof Date ? r.checkInDate.toISOString() : r.checkInDate,
                        check_out: r.checkOutDate instanceof Date ? r.checkOutDate.toISOString() : r.checkOutDate,
                        memo: r.requests || '',
                        status: 'scheduled' as const,
                        source: 'raonai' as const,
                        created_at: r.createdAt ? (r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt) : new Date().toISOString(),
                        updated_at: new Date().toISOString(),
                        is_pending_reservation: true // 가상 플래그
                    };
                });

            const scheduledList = allSchedules.filter(s => s.status === 'scheduled');
            const combined = [...pendingReservations, ...scheduledList];
            // 날짜 정렬 (체크인 빠른 순)
            combined.sort((a, b) => new Date(a.check_in).getTime() - new Date(b.check_in).getTime());
            return combined as Schedule[];
        } else if (activeTab === 'completed') {
            const list = allSchedules.filter(s => s.status === 'completed');
            list.sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime());
            return list;
        } else {
            const list = allSchedules.filter(s => s.status === 'cancelled');
            list.sort((a, b) => new Date(b.check_in).getTime() - new Date(a.check_in).getTime());
            return list;
        }
    }, [activeTab, allSchedules, reservations]);

    // 일정 삭제 (낙관적 UI 업데이트 + 캐시 동기화)
    const handleDelete = async () => {
        if (!deleteTarget) return;

        const targetId = deleteTarget;
        setDeleteTarget(null);
        setAllSchedules(prev => {
            const next = prev.filter(s => s.id !== targetId);
            try { localStorage.setItem('user_schedules_cache', JSON.stringify(next)); } catch {}
            return next;
        });

        const result = await deleteSchedule(targetId);
        if (result.success) {
            toast.success('일정이 삭제되었어요');
        } else {
            toast.error(result.error || '삭제에 실패했어요');
            loadData(false);
        }
    };

    // 일정 완료 (낙관적 UI 업데이트 + 캐시 동기화)
    const handleComplete = async (scheduleId: string) => {
        setAllSchedules(prev => {
            const next = prev.map(s => s.id === scheduleId ? { ...s, status: 'completed' as const } : s);
            try { localStorage.setItem('user_schedules_cache', JSON.stringify(next)); } catch {}
            return next;
        });

        const result = await completeSchedule(scheduleId);
        if (result.success) {
            toast.success('캠핑 완료! 🏕️');
        } else {
            toast.error(result.error || '처리에 실패했어요');
            loadData(false);
        }
    };

    // 일정 상세로 이동
    const handleScheduleClick = (schedule: Schedule) => {
        if ((schedule as any).is_pending_reservation) {
            router.push('/reservation/complete');
            return;
        }
        router.push(`/myspace/schedule/${schedule.id}`);
    };

    // 일정 등록 성공
    const handleFormSuccess = () => {
        setIsFormOpen(false);
        loadData(false);
    };

    // 취소 요청 핸들러
    const handleCancelRequest = (schedule: Schedule) => {
        if (!schedule.reservation_id) return;
        const res = reservations.find(r => r.id === schedule.reservation_id);
        if (!res) {
            toast.error('예약 정보를 찾을 수 없어요');
            return;
        }

        setCancelTarget(res);
        if (res.status === 'PENDING') {
            setPendingCancelConfirmOpen(true);
        } else {
            setCancelSheetOpen(true);
        }
    };

    // 입금대기 바로 취소
    const handleDirectCancel = async () => {
        if (!cancelTarget) return;
        setIsCancelling(true);
        try {
            await updateReservationStatus(cancelTarget.id, 'CANCELLED');
            toast.success('예약이 취소되었어요');
            setPendingCancelConfirmOpen(false);
            setCancelTarget(null);
            loadData(false);
        } catch {
            toast.error('취소 처리에 실패했어요');
        } finally {
            setIsCancelling(false);
        }
    };

    const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
        { key: 'scheduled', label: '예정된', icon: <Calendar className="w-4 h-4" /> },
        { key: 'completed', label: '완료', icon: <CheckCircle2 className="w-4 h-4" /> },
        { key: 'cancelled', label: '취소', icon: <XCircle className="w-4 h-4" /> },
    ];

    // [v14.3.0] 마운트 전 깜빡이는 중앙 스피너 제거하고 자연스러운 배경 유지
    if (!isMounted) {
        return <div className="min-h-screen bg-[#F8FAF8]" />;
    }

    return (
        <div className="min-h-screen bg-[#F8FAF8]">
            {/* 헤더 */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <div className="flex items-center justify-between px-4 h-14">
                    <button
                        onClick={() => {
                            try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}
                            router.back();
                        }}
                        className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-gray-700" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900">나의 여행일정</h1>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#388E5A] text-white hover:bg-[#2F774B] transition-colors text-sm font-medium"
                        aria-label="새 일정 추가"
                    >
                        <Plus className="w-4 h-4" />
                        <span>일정추가</span>
                    </button>
                </div>

                {/* 탭 */}
                <div className="flex px-4 gap-2 pb-3">
                    {tabs.map((tab) => (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`
                                flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium transition-all
                                ${activeTab === tab.key
                                    ? 'bg-[#388E5A] text-white shadow-sm'
                                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                }
                            `}
                        >
                            {tab.icon}
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* 컨텐츠 */}
            <div className="p-4">
                {isLoading ? (
                    // 로딩 스켈레톤
                    <div className="space-y-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="bg-white rounded-2xl p-4 animate-pulse">
                                <div className="flex items-start justify-between mb-3">
                                    <div>
                                        <div className="h-5 w-20 bg-gray-200 rounded mb-2" />
                                        <div className="h-6 w-40 bg-gray-200 rounded" />
                                    </div>
                                    <div className="h-8 w-8 bg-gray-200 rounded-lg" />
                                </div>
                                <div className="h-4 w-48 bg-gray-200 rounded mb-3" />
                                <div className="h-4 w-32 bg-gray-200 rounded" />
                            </div>
                        ))}
                    </div>
                ) : schedules.length === 0 ? (
                    // 빈 상태
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                        <div className="w-20 h-20 rounded-full bg-[#EDF5EE] flex items-center justify-center mb-4">
                            <Tent className="w-10 h-10 text-[#388E5A]" />
                        </div>
                        <h3 className="text-lg font-medium text-gray-900 mb-1">
                            {activeTab === 'scheduled' && '예정된 캠핑이 없어요'}
                            {activeTab === 'completed' && '아직 완료된 캠핑이 없어요'}
                            {activeTab === 'cancelled' && '취소된 일정이 없어요'}
                        </h3>
                        <p className="text-sm text-gray-500 mb-6">
                            {activeTab === 'scheduled'
                                ? '새로운 캠핑 일정을 등록해보세요!'
                                : '캠핑을 다녀오시면 여기에 기록됩니다'
                            }
                        </p>
                        {activeTab === 'scheduled' && (
                            <Button
                                onClick={() => setIsFormOpen(true)}
                                className="bg-[#388E5A] hover:bg-[#2F774B] text-white"
                            >
                                <Plus className="w-4 h-4 mr-1" />
                                일정 등록하기
                            </Button>
                        )}
                    </div>
                ) : (
                    // 일정 목록
                    <div className="space-y-4">
                        {schedules.map((schedule) => (
                            <ScheduleCard
                                key={schedule.id}
                                schedule={schedule}
                                onClick={(schedule as any).is_pending_reservation ? undefined : handleScheduleClick}
                                onComplete={handleComplete}
                                onDelete={setDeleteTarget}
                                onCancelRequest={handleCancelRequest}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 일정 등록 시트 */}
            <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
                <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="text-left">새로운 여행 등록</SheetTitle>
                    </SheetHeader>
                    <ScheduleForm
                        onSuccess={handleFormSuccess}
                        onCancel={() => setIsFormOpen(false)}
                    />
                </SheetContent>
            </Sheet>

            {/* 삭제 확인 다이얼로그 */}
            <AlertDialog open={!!deleteTarget} onOpenChange={() => setDeleteTarget(null)}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>일정을 삭제할까요?</AlertDialogTitle>
                        <AlertDialogDescription>
                            삭제된 일정은 복구할 수 없어요.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                        >
                            삭제
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 입금 대기 취소 확인 다이얼로그 */}
            <AlertDialog open={pendingCancelConfirmOpen} onOpenChange={setPendingCancelConfirmOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>예약을 취소하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                            아직 입금하지 않은 예약입니다. 취소하시면 예약이 즉시 취소됩니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>돌아가기</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDirectCancel}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isCancelling}
                        >
                            {isCancelling ? '취소 중...' : '예약 취소'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>

            {/* 확정 예약 취소요청 바텀시트 */}
            {cancelTarget && (
                <CancelReservationSheet
                    open={cancelSheetOpen}
                    onOpenChange={setCancelSheetOpen}
                    reservation={cancelTarget}
                    onComplete={() => {
                        setCancelSheetOpen(false);
                        setCancelTarget(null);
                        loadData(false);
                    }}
                />
            )}
        </div>
    );
}

export default function SchedulePage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#F8FAF8] flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-[#388E5A]" />
            </div>
        }>
            <ScheduleContent />
        </Suspense>
    );
}
