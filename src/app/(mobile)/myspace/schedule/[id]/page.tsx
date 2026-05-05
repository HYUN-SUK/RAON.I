'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
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
    ExternalLink,
    Pencil
} from 'lucide-react';
import {
    Schedule,
    ChecklistItem,
    getScheduleById,
    getChecklist,
    addChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    completeSchedule,
    updateSchedule,
    deleteSchedule
} from '@/actions/schedule';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import MealRecommendationWidget from '@/components/myspace/MealRecommendationWidget';
import { getPersonalizedRecommendations, RecipeSearchResult } from '@/actions/recommendation';
import SmartPlanProposal from '@/components/plan/SmartPlanProposal';
import { createClient } from '@/lib/supabase-client';
import CampingProfileGate from '@/components/shared/CampingProfileGate';
import { CampingProfile, getCampingProfile } from '@/actions/camping-profile';


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
    const searchParams = useSearchParams();
    const scheduleId = params.id as string;
    const initialRecipeId = searchParams.get('recipeId');

    const [userId, setUserId] = useState<string>();
    const [showSmartPlan, setShowSmartPlan] = useState(false);
    const [smartPlanOrigin, setSmartPlanOrigin] = useState<{ lat: number; lng: number } | undefined>();
    const [showProfileGate, setShowProfileGate] = useState(false);
    const [planKey, setPlanKey] = useState(0); // [v11.9.40] 재구성 시 컴포넌트 강제 리마운트용
    const [isReconstructing, setIsReconstructing] = useState(false); // [v11.9.40] 재구성 중에는 기존 데이터를 무시

    useEffect(() => {
        const fetchUser = async () => {
            const supabase = createClient();
            const { data: { session } } = await supabase.auth.getSession();
            if (session?.user?.id) {
                setUserId(session.user.id);
            }
        };
        fetchUser();
    }, []);

    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newItem, setNewItem] = useState('');
    const [isAddingItem, setIsAddingItem] = useState(false);

    // Meal Recommendations State
    const [mealRecommendations, setMealRecommendations] = useState<any[]>([]);
    const [recommendationRationale, setRecommendationRationale] = useState('');

    // 수정/삭제 상태
    const [isEditSheetOpen, setIsEditSheetOpen] = useState(false);
    const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [editForm, setEditForm] = useState({
        campground_name: '',
        check_in: '',
        check_out: '',
        memo: ''
    });

    // 수정 폼 초기화
    useEffect(() => {
        if (schedule) {
            setEditForm({
                campground_name: schedule.campground_name,
                check_in: schedule.check_in,
                check_out: schedule.check_out,
                memo: schedule.memo || ''
            });
        }
    }, [schedule]);

    // Fetch Recommendations
    const fetchRecs = useCallback(async (isRefresh = false) => {
        if (!schedule) return;

        // If refreshing, we ignore the initialRecipeId to give fresh results
        const targetInitialId = isRefresh ? null : initialRecipeId;

        // 1. Fetch Personalized Logic (Randomized context-aware)
        // returns { recommendations, rationale }
        const { recommendations: recs, rationale } = await getPersonalizedRecommendations(3, {
            lat: schedule.campground_lat,
            lng: schedule.campground_lng,
            dateStr: schedule.check_in,
            memberCount: schedule.member_count
        });

        setRecommendationRationale(rationale);

        // 2. If Notification Deep Link exists, ensure it's in the list (prepend)
        // Only do this on first load (not refresh)
        let finalRecs = [...recs];

        if (targetInitialId) {
            // Check if already in list
            const exists = finalRecs.find(r => r.id === targetInitialId);
            if (!exists) {
                // Fetch specific recipe
                const { getRecipeById } = await import('@/actions/recommendation');
                const targetRecipe = await getRecipeById(targetInitialId);

                if (targetRecipe) {
                    // Map loosely to RecipeSearchResult
                    const mappedTarget: any = { // TODO: sanitize type
                        id: targetRecipe.id,
                        title: targetRecipe.title,
                        description: targetRecipe.description,
                        category: targetRecipe.category,
                        image_url: targetRecipe.image_url,
                        difficulty: targetRecipe.difficulty || targetRecipe.metadata?.difficulty,
                        tags: targetRecipe.tags
                    };
                    // Prepend and keep max 3
                    finalRecs = [mappedTarget, ...finalRecs].slice(0, 3);
                }
            } else {
                // If exists, move to top?
                finalRecs = [exists, ...finalRecs.filter(r => r.id !== targetInitialId)];
            }
        }

        const mappedRecs = finalRecs.map((r: any) => ({
            id: r.id,
            title: r.title,
            description: r.description || '',
            tags: r.tags || [],
            difficulty: r.difficulty || 1,
            season: []
        }));
        setMealRecommendations(mappedRecs as any);
    }, [schedule, initialRecipeId]);

    useEffect(() => {
        fetchRecs();
    }, [fetchRecs]);

    const handleRefreshRecommendations = () => {
        fetchRecs(true);
    };

    // 일정 수정
    const handleUpdate = async () => {
        if (!schedule) return;
        setIsUpdating(true);
        try {
            const result = await updateSchedule(schedule.id, {
                campground_name: editForm.campground_name,
                check_in: editForm.check_in,
                check_out: editForm.check_out,
                memo: editForm.memo || undefined
            });
            if (result.success) {
                toast.success('일정이 수정되었어요!');
                setIsEditSheetOpen(false);
                loadData();
            } else {
                toast.error(result.error || '수정에 실패했어요');
            }
        } catch {
            toast.error('오류가 발생했어요');
        } finally {
            setIsUpdating(false);
        }
    };

    // 일정 삭제
    const handleDelete = async () => {
        if (!schedule) return;
        setIsDeleting(true);
        try {
            const result = await deleteSchedule(schedule.id);
            if (result.success) {
                toast.success('일정이 삭제되었어요');
                router.push('/myspace/schedule');
            } else {
                toast.error(result.error || '삭제에 실패했어요');
            }
        } catch {
            toast.error('오류가 발생했어요');
        } finally {
            setIsDeleting(false);
        }
    };

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

    // [v11.9.32] 저장된 스마트 플랜 데이터가 있다면 자동으로 표시 (복구)
    useEffect(() => {
        if (schedule?.smart_plan_data && !showSmartPlan && !showProfileGate && !isReconstructing) {
            setShowSmartPlan(true);
        }
    }, [schedule, showSmartPlan, showProfileGate, isReconstructing]);

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
                    <h1 className="text-lg font-semibold text-gray-900 truncate max-w-[180px]">
                        {schedule.campground_name}
                    </h1>
                    {/* 타캠핑장 일정만 수정/삭제 가능 */}
                    {schedule.source === 'external' ? (
                        <div className="flex items-center gap-1">
                            <button
                                onClick={() => setIsEditSheetOpen(true)}
                                className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
                                title="수정"
                            >
                                <Pencil className="w-5 h-5 text-gray-600" />
                            </button>
                            <button
                                onClick={() => setIsDeleteDialogOpen(true)}
                                className="p-2 rounded-lg hover:bg-red-50 transition-colors"
                                title="삭제"
                            >
                                <Trash2 className="w-5 h-5 text-red-500" />
                            </button>
                        </div>
                    ) : (
                        <div className="w-10" />
                    )}
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

                {/* 스마트 캠핑 플랜 UI (Gap 1: Trigger UI) */}
                <div className="mt-6 mb-4">
                    {!showSmartPlan ? (() => {
                        const checkInDate = new Date(schedule.check_in);
                        // D-3 오전 9시 기준 설정
                        const unlockTime = new Date(checkInDate);
                        unlockTime.setDate(unlockTime.getDate() - 3);
                        unlockTime.setHours(9, 0, 0, 0);

                        const isLocked = new Date() < unlockTime;
                        const lockedMessage = "최적의 팩트 선별 및 초정밀 단기 일기예보 반영을 위해, 캠핑 3일 전 오전 9시부터 오픈됩니다!";

                        // 프로필 게이트 표시 중 (확인 및 수정 단계)
                        if (showProfileGate) {
                            return (
                                <div className="space-y-3">
                                    <CampingProfileGate
                                        onComplete={(profile) => {
                                            setSmartPlanOrigin(
                                                profile.originLat && profile.originLng
                                                    ? { lat: profile.originLat, lng: profile.originLng }
                                                    : undefined
                                            );
                                            setShowProfileGate(false);
                                            setShowSmartPlan(true);
                                        }}
                                        requireOrigin={true}
                                        title="완벽한 추천을 위한 정보 확인"
                                    />
                                    <Button 
                                        variant="ghost" 
                                        size="sm"
                                        onClick={() => setShowProfileGate(false)}
                                        className="w-full text-gray-400 text-[11px] hover:bg-transparent"
                                    >
                                        플랜 생성을 나중에 할게요
                                    </Button>
                                </div>
                            );
                        }

                        return (
                            <div className="relative group">
                                <Button
                                    onClick={async () => {
                                        if (isLocked) return;
                                        // [v11.9.32] 프로필이 있더라도 무조건 게이트(확인/수정창)를 먼저 띄웁니다.
                                        setShowProfileGate(true);
                                    }}
                                    disabled={isLocked}
                                    className={`w-full h-14 ${isLocked ? 'bg-gray-300 cursor-not-allowed text-gray-500 shadow-none hover:scale-100' : 'bg-gradient-to-r from-[#224732] to-[#1a3626] hover:from-[#1a3626] hover:to-[#1a3626] text-white shadow-[0_4px_14px_0_rgba(34,71,50,0.39)] transition-all hover:scale-[1.02]'} rounded-2xl text-base font-semibold`}
                                >
                                    <span className="mr-2 text-xl">✨</span> 이번 캠핑계획 자동 완성하기
                                </Button>
                                {isLocked && (
                                    <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 w-max max-w-[90vw] bg-gray-800 text-white text-xs px-3 py-2 rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity z-50 text-center pointer-events-none">
                                        {lockedMessage}
                                        <div className="absolute -top-1 left-1/2 -translate-x-1/2 border-x-4 border-x-transparent border-b-4 border-b-gray-800" />
                                    </div>
                                )}
                            </div>
                        );
                    })() : (
                        <SmartPlanProposal
                            key={planKey}
                            scheduleId={schedule.id}
                            initialPlan={isReconstructing ? null : schedule.smart_plan_data}
                            userId={userId}
                            location={{
                                lat: schedule.campground_lat || 36.67,
                                lng: schedule.campground_lng || 126.84
                            }}
                            startDate={new Date(schedule.check_in)}
                            endDate={new Date(schedule.check_out)}
                            origin={smartPlanOrigin}
                            onReset={() => {
                                setIsReconstructing(true);
                                setShowSmartPlan(false);
                                setShowProfileGate(true);
                                setPlanKey(prev => prev + 1);
                            }}
                            onGenerated={() => setIsReconstructing(false)}
                        />
                    )}
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

                {/* 추천 요리 위젯 */}
                <MealRecommendationWidget
                    recommendations={mealRecommendations}
                    initialRecipeId={initialRecipeId}
                    onRefresh={handleRefreshRecommendations}
                    rationale={recommendationRationale}
                />

                {/* 하단 여백 (버튼이 있을 경우) */}
                {schedule.status === 'scheduled' && daysUntil <= 0 && (
                    <div className="h-20" />
                )}
            </div>



            {/* 수정 Sheet */}
            <Sheet open={isEditSheetOpen} onOpenChange={setIsEditSheetOpen}>
                <SheetContent side="bottom" className="rounded-t-3xl max-h-[85vh] overflow-y-auto">
                    <SheetHeader className="pb-4 border-b border-gray-100">
                        <SheetTitle className="flex items-center gap-2">
                            <Pencil className="w-5 h-5 text-[#224732]" />
                            일정 수정
                        </SheetTitle>
                    </SheetHeader>
                    <div className="py-5 space-y-4">
                        {/* 캠핑장 이름 */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">캠핑장 이름</label>
                            <Input
                                value={editForm.campground_name}
                                onChange={(e) => setEditForm({ ...editForm, campground_name: e.target.value })}
                                placeholder="캠핑장 이름"
                            />
                        </div>
                        {/* 일정 */}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">입실일</label>
                                <Input
                                    type="date"
                                    value={editForm.check_in}
                                    onChange={(e) => setEditForm({ ...editForm, check_in: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="text-sm font-medium text-gray-700 mb-2 block">퇴실일</label>
                                <Input
                                    type="date"
                                    value={editForm.check_out}
                                    onChange={(e) => setEditForm({ ...editForm, check_out: e.target.value })}
                                />
                            </div>
                        </div>
                        {/* 메모 */}
                        <div>
                            <label className="text-sm font-medium text-gray-700 mb-2 block">메모</label>
                            <Textarea
                                value={editForm.memo}
                                onChange={(e) => setEditForm({ ...editForm, memo: e.target.value })}
                                placeholder="메모를 입력하세요"
                                rows={3}
                            />
                        </div>
                        {/* 버튼 */}
                        <div className="flex gap-3 pt-2">
                            <Button
                                variant="outline"
                                onClick={() => setIsEditSheetOpen(false)}
                                className="flex-1"
                                disabled={isUpdating}
                            >
                                취소
                            </Button>
                            <Button
                                onClick={handleUpdate}
                                className="flex-1 bg-[#224732] hover:bg-[#1a3626]"
                                disabled={isUpdating || !editForm.campground_name.trim()}
                            >
                                {isUpdating ? (
                                    <>
                                        <Loader2 className="w-4 h-4 mr-1 animate-spin" />
                                        저장 중...
                                    </>
                                ) : (
                                    '저장하기'
                                )}
                            </Button>
                        </div>
                    </div>
                </SheetContent>
            </Sheet>

            {/* 삭제 확인 AlertDialog */}
            <AlertDialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>일정을 삭제하시겠습니까?</AlertDialogTitle>
                        <AlertDialogDescription>
                            <strong>{schedule.campground_name}</strong> 일정이 삭제됩니다.
                            이 작업은 되돌릴 수 없습니다.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel disabled={isDeleting}>취소</AlertDialogCancel>
                        <AlertDialogAction
                            onClick={handleDelete}
                            className="bg-red-600 hover:bg-red-700"
                            disabled={isDeleting}
                        >
                            {isDeleting ? '삭제 중...' : '삭제'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}
