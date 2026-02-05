'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
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
import ScheduleForm from '@/components/schedule/ScheduleForm';
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

export default function SchedulePage() {
    const router = useRouter();
    const [activeTab, setActiveTab] = useState<TabType>('scheduled');
    const [schedules, setSchedules] = useState<Schedule[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isFormOpen, setIsFormOpen] = useState(false);
    const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

    // 일정 조회
    const fetchSchedules = async () => {
        setIsLoading(true);
        try {
            const data = await getMySchedules(activeTab);
            setSchedules(data);
        } catch (error) {
            console.error('Fetch schedules error:', error);
            toast.error('일정을 불러오는데 실패했어요');
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchSchedules();
    }, [activeTab]);

    // 일정 삭제
    const handleDelete = async () => {
        if (!deleteTarget) return;

        const result = await deleteSchedule(deleteTarget);
        if (result.success) {
            toast.success('일정이 삭제되었어요');
            setSchedules(prev => prev.filter(s => s.id !== deleteTarget));
        } else {
            toast.error(result.error || '삭제에 실패했어요');
        }
        setDeleteTarget(null);
    };

    // 일정 완료
    const handleComplete = async (scheduleId: string) => {
        const result = await completeSchedule(scheduleId);
        if (result.success) {
            toast.success('캠핑 완료! 🏕️');
            setSchedules(prev => prev.filter(s => s.id !== scheduleId));
        } else {
            toast.error(result.error || '처리에 실패했어요');
        }
    };

    // 일정 상세로 이동
    const handleScheduleClick = (schedule: Schedule) => {
        router.push(`/myspace/schedule/${schedule.id}`);
    };

    // 일정 등록 성공
    const handleFormSuccess = () => {
        setIsFormOpen(false);
        fetchSchedules();
    };

    const tabs: { key: TabType; label: string; icon: React.ReactNode }[] = [
        { key: 'scheduled', label: '예정된', icon: <Calendar className="w-4 h-4" /> },
        { key: 'completed', label: '완료', icon: <CheckCircle2 className="w-4 h-4" /> },
        { key: 'cancelled', label: '취소', icon: <XCircle className="w-4 h-4" /> },
    ];

    return (
        <div className="min-h-screen bg-[#F7F5EF]">
            {/* 헤더 */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <div className="flex items-center justify-between px-4 h-14">
                    <button
                        onClick={() => router.back()}
                        className="p-2 -ml-2 rounded-lg hover:bg-gray-100 transition-colors"
                    >
                        <ChevronLeft className="w-6 h-6 text-gray-700" />
                    </button>
                    <h1 className="text-lg font-semibold text-gray-900">내 캠핑 일정</h1>
                    <button
                        onClick={() => setIsFormOpen(true)}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-[#224732] text-white hover:bg-[#1a3626] transition-colors text-sm font-medium"
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
                                    ? 'bg-[#224732] text-white shadow-sm'
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
                        <div className="w-20 h-20 rounded-full bg-[#224732]/10 flex items-center justify-center mb-4">
                            <Tent className="w-10 h-10 text-[#224732]" />
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
                                className="bg-[#224732] hover:bg-[#1a3626]"
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
                                onClick={handleScheduleClick}
                                onComplete={handleComplete}
                                onDelete={setDeleteTarget}
                            />
                        ))}
                    </div>
                )}
            </div>

            {/* 일정 등록 시트 */}
            <Sheet open={isFormOpen} onOpenChange={setIsFormOpen}>
                <SheetContent side="bottom" className="h-[85vh] rounded-t-3xl">
                    <SheetHeader className="mb-4">
                        <SheetTitle className="text-left">새 캠핑 일정</SheetTitle>
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
        </div>
    );
}
