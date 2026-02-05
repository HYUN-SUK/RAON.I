'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    ChevronLeft,
    MapPin,
    Calendar,
    Clock,
    FileText,
    CheckSquare,
    Plus,
    Trash2,
    Check,
    Circle,
    Loader2,
    ExternalLink
} from 'lucide-react';
import {
    Schedule,
    ChecklistItem,
    getScheduleById,
    getChecklist,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    completeSchedule
} from '@/actions/schedule';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';

const CHECKLIST_CATEGORY_LABELS: Record<ChecklistItem['category'], string> = {
    essential: '필수품',
    cooking: '요리/식재료',
    sleeping: '취침용품',
    activity: '놀이/레저',
    etc: '기타',
};

export default function ScheduleDetailPage() {
    const params = useParams();
    const router = useRouter();
    const scheduleId = params.id as string;

    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newItem, setNewItem] = useState('');
    const [isAddingItem, setIsAddingItem] = useState(false);

    // 데이터 로드
    const loadData = useCallback(async () => {
        setIsLoading(true);
        try {
            const [scheduleData, checklistData] = await Promise.all([
                getScheduleById(scheduleId),
                getChecklist(scheduleId),
            ]);
            setSchedule(scheduleData);
            setChecklist(checklistData);
        } catch (error) {
            console.error('Load schedule detail error:', error);
            toast.error('일정을 불러오는데 실패했어요');
        } finally {
            setIsLoading(false);
        }
    }, [scheduleId]);

    useEffect(() => {
        loadData();
    }, [loadData]);

    // 체크리스트 아이템 추가
    const handleAddItem = async () => {
        if (!newItem.trim()) return;

        setIsAddingItem(true);
        const result = await addChecklistItem(scheduleId, newItem.trim());

        if (result.success && result.id) {
            setChecklist(prev => [...prev, {
                id: result.id!,
                schedule_id: scheduleId,
                item: newItem.trim(),
                is_checked: false,
                category: 'etc',
                sort_order: prev.length,
            }]);
            setNewItem('');
            toast.success('준비물이 추가되었어요');
        } else {
            toast.error(result.error || '추가에 실패했어요');
        }
        setIsAddingItem(false);
    };

    // 체크리스트 아이템 토글
    const handleToggleItem = async (itemId: string) => {
        const result = await toggleChecklistItem(itemId);

        if (result.success) {
            setChecklist(prev => prev.map(item =>
                item.id === itemId ? { ...item, is_checked: result.checked! } : item
            ));
        }
    };

    // 체크리스트 아이템 삭제
    const handleDeleteItem = async (itemId: string) => {
        const result = await deleteChecklistItem(itemId);

        if (result.success) {
            setChecklist(prev => prev.filter(item => item.id !== itemId));
            toast.success('삭제되었어요');
        }
    };

    // 일정 완료
    const handleComplete = async () => {
        if (!schedule) return;

        const result = await completeSchedule(schedule.id);
        if (result.success) {
            toast.success('캠핑 완료! 🏕️');
            router.push('/myspace/schedule');
        }
    };

    // 로딩 상태
    if (isLoading) {
        return (
            <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#224732] animate-spin" />
            </div>
        );
    }

    // 일정 없음
    if (!schedule) {
        return (
            <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center p-4">
                <p className="text-gray-500 mb-4">일정을 찾을 수 없어요</p>
                <Button onClick={() => router.back()} variant="outline">
                    돌아가기
                </Button>
            </div>
        );
    }

    const checkIn = parseISO(schedule.check_in);
    const checkOut = parseISO(schedule.check_out);
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const daysUntil = differenceInDays(checkIn, today);
    const nights = differenceInDays(checkOut, checkIn);
    const checkedCount = checklist.filter(i => i.is_checked).length;

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
                    <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[200px]">
                        {schedule.campground_name}
                    </h1>
                    <div className="w-10" />
                </div>
            </div>

            <div className="p-4 space-y-4">
                {/* D-Day 히어로 */}
                <div className="bg-gradient-to-br from-[#224732] to-[#1a3626] rounded-2xl p-6 text-white">
                    <div className="flex items-center justify-between mb-4">
                        {schedule.source === 'raonai' && (
                            <span className="px-2 py-1 rounded-full text-xs bg-white/20">
                                라온아이 예약
                            </span>
                        )}
                        {schedule.status === 'scheduled' && daysUntil >= 0 && (
                            <span className="text-3xl font-bold">
                                {daysUntil === 0 ? 'D-Day!' : `D-${daysUntil}`}
                            </span>
                        )}
                        {schedule.status === 'completed' && (
                            <span className="px-3 py-1 rounded-full text-sm bg-white/20">
                                완료된 캠핑
                            </span>
                        )}
                    </div>
                    <h2 className="text-xl font-bold mb-1">{schedule.campground_name}</h2>
                    {schedule.campground_address && (
                        <p className="text-sm text-white/80 flex items-center gap-1">
                            <MapPin className="w-4 h-4" />
                            {schedule.campground_address}
                        </p>
                    )}
                </div>

                {/* 일정 정보 */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#224732]" />
                        일정 정보
                    </h3>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <p className="text-xs text-gray-500 mb-1">입실일</p>
                            <p className="font-medium text-gray-900">
                                {format(checkIn, 'yyyy.M.d (EEE)', { locale: ko })}
                            </p>
                        </div>
                        <div>
                            <p className="text-xs text-gray-500 mb-1">퇴실일</p>
                            <p className="font-medium text-gray-900">
                                {format(checkOut, 'yyyy.M.d (EEE)', { locale: ko })}
                            </p>
                        </div>
                    </div>
                    <div className="mt-3 pt-3 border-t border-gray-100 flex items-center gap-2 text-sm text-gray-600">
                        <Clock className="w-4 h-4" />
                        <span>{nights}박 {nights + 1}일</span>
                    </div>
                </div>

                {/* 메모 */}
                {schedule.memo && (
                    <div className="bg-white rounded-2xl p-4 shadow-sm">
                        <h3 className="font-semibold text-gray-900 mb-2 flex items-center gap-2">
                            <FileText className="w-5 h-5 text-[#224732]" />
                            메모
                        </h3>
                        <p className="text-gray-700 whitespace-pre-wrap">{schedule.memo}</p>
                    </div>
                )}

                {/* 준비물 체크리스트 */}
                <div className="bg-white rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-3">
                        <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                            <CheckSquare className="w-5 h-5 text-[#224732]" />
                            준비물 체크리스트
                        </h3>
                        {checklist.length > 0 && (
                            <span className="text-sm text-gray-500">
                                {checkedCount}/{checklist.length}
                            </span>
                        )}
                    </div>

                    {/* 아이템 추가 */}
                    <div className="flex gap-2 mb-4">
                        <Input
                            type="text"
                            placeholder="준비물 추가..."
                            value={newItem}
                            onChange={(e) => setNewItem(e.target.value)}
                            onKeyDown={(e) => e.key === 'Enter' && handleAddItem()}
                            className="flex-1"
                        />
                        <Button
                            size="icon"
                            onClick={handleAddItem}
                            disabled={!newItem.trim() || isAddingItem}
                            className="bg-[#224732] hover:bg-[#1a3626]"
                        >
                            {isAddingItem ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                                <Plus className="w-4 h-4" />
                            )}
                        </Button>
                    </div>

                    {/* 체크리스트 */}
                    {checklist.length === 0 ? (
                        <p className="text-center text-gray-400 py-6 text-sm">
                            준비물을 추가해보세요
                        </p>
                    ) : (
                        <ul className="space-y-2">
                            {checklist.map((item) => (
                                <li
                                    key={item.id}
                                    className="flex items-center gap-3 py-2 px-3 rounded-lg hover:bg-gray-50 transition-colors group"
                                >
                                    <button
                                        onClick={() => handleToggleItem(item.id)}
                                        className="flex-shrink-0"
                                    >
                                        {item.is_checked ? (
                                            <Check className="w-5 h-5 text-[#224732]" />
                                        ) : (
                                            <Circle className="w-5 h-5 text-gray-300" />
                                        )}
                                    </button>
                                    <span className={`flex-1 ${item.is_checked ? 'line-through text-gray-400' : 'text-gray-700'}`}>
                                        {item.item}
                                    </span>
                                    <button
                                        onClick={() => handleDeleteItem(item.id)}
                                        className="opacity-0 group-hover:opacity-100 p-1 hover:bg-red-50 rounded transition-all"
                                    >
                                        <Trash2 className="w-4 h-4 text-red-400" />
                                    </button>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>

                {/* 지도 바로가기 */}
                {schedule.campground_lat && schedule.campground_lng && (
                    <a
                        href={`https://map.kakao.com/link/to/${encodeURIComponent(schedule.campground_name)},${schedule.campground_lat},${schedule.campground_lng}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block bg-white rounded-2xl p-4 shadow-sm hover:bg-gray-50 transition-colors"
                    >
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div className="w-10 h-10 rounded-full bg-[#224732]/10 flex items-center justify-center">
                                    <MapPin className="w-5 h-5 text-[#224732]" />
                                </div>
                                <div>
                                    <p className="font-medium text-gray-900">길찾기</p>
                                    <p className="text-sm text-gray-500">카카오맵으로 열기</p>
                                </div>
                            </div>
                            <ExternalLink className="w-5 h-5 text-gray-400" />
                        </div>
                    </a>
                )}
            </div>

            {/* 하단 버튼 */}
            {schedule.status === 'scheduled' && daysUntil <= 0 && (
                <div className="fixed bottom-0 left-0 right-0 p-4 bg-white border-t border-gray-100">
                    <Button
                        onClick={handleComplete}
                        className="w-full bg-[#224732] hover:bg-[#1a3626] h-12 text-base"
                    >
                        <Check className="w-5 h-5 mr-2" />
                        캠핑 완료하기
                    </Button>
                </div>
            )}
        </div>
    );
}
