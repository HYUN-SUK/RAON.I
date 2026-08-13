'use client';

import { useState, useEffect, useCallback, useMemo, useRef, Suspense } from 'react';
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
    deleteSchedule,
    checkCandidateCacheAction
} from '@/actions/schedule';
import { Button } from '@/components/ui/button';
import { useWeather } from '@/hooks/useWeather';
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
import SmartPlanModeSelector from '@/components/plan/SmartPlanModeSelector';
import { DEV_PRO_USER_ID } from '@/lib/timelineBuilder';
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

function ScheduleDetailContent() {
    const params = useParams();
    const router = useRouter();
    const searchParams = useSearchParams();
    const scheduleId = params.id as string;
    const initialRecipeId = searchParams.get('recipeId');

    const [isMounted, setIsMounted] = useState(false);
    const isMountedRef = useRef(true);
    const [userId, setUserId] = useState<string>();

    useEffect(() => {
        setIsMounted(true);
        isMountedRef.current = true;
        return () => {
            isMountedRef.current = false;
        };
    }, []);
    const [userEmail, setUserEmail] = useState<string>();
    const [showSmartPlan, setShowSmartPlan] = useState(false);
    const [smartPlanOrigin, setSmartPlanOrigin] = useState<{ lat: number; lng: number } | undefined>();
    const [showProfileGate, setShowProfileGate] = useState(false);
    const [planKey, setPlanKey] = useState(0);
    const [isReconstructing, setIsReconstructing] = useState(false);
    // PRO 모드 상태
    const [showModeSelector, setShowModeSelector] = useState(false);
    const [planMode, setPlanMode] = useState<'BASIC' | 'PRO'>('BASIC');
    const [travelType, setTravelType] = useState<'camping' | 'general'>('general');
    const isPro = useMemo(() => {
        if (userId === DEV_PRO_USER_ID) return true;
        if (userEmail && ['tootg@naver.com', 'admin@raon.ai'].includes(userEmail.toLowerCase())) return true;
        return false;
    }, [userId, userEmail]);

    const [isUserLoading, setIsUserLoading] = useState(true);
    const [isCached, setIsCached] = useState(false);

    // [v11.9.105] 진입 시 라우터 캐시 무효화로 인한 홈 화면 튕김 부작용 제거

    useEffect(() => {
        let isComponentMounted = true;
        const fetchUser = async () => {
            try {
                const supabase = createClient();
                const { data: { session } } = await supabase.auth.getSession();
                if (isComponentMounted && session?.user?.id) {
                    setUserId(session.user.id);
                    setUserEmail(session.user.email);
                }
            } catch (e) {
                console.error('Fetch user session error:', e);
            } finally {
                if (isComponentMounted) setIsUserLoading(false);
            }
        };
        fetchUser();

        // [v11.9.109] 일정 상세 진입 시 홈 복귀 시 아코디언 펼침 세션 플래그 보장
        try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}

        const handlePopState = () => {
            try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}
        };
        window.addEventListener('popstate', handlePopState);
        return () => {
            isComponentMounted = false;
            window.removeEventListener('popstate', handlePopState);
        };
    }, []);

    const [schedule, setSchedule] = useState<Schedule | null>(null);
    const [checklist, setChecklist] = useState<ChecklistItem[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [newItem, setNewItem] = useState('');
    const [isAddingItem, setIsAddingItem] = useState(false);

    // [Fix] Instant cache check from localStorage to present schedule within 0.001s
    useEffect(() => {
        if (scheduleId) {
            try {
                const raw = localStorage.getItem('user_schedules_cache');
                if (raw) {
                    const list: Schedule[] = JSON.parse(raw);
                    const found = list.find(s => s.id === scheduleId);
                    if (found) {
                        setSchedule(found);
                    }
                }
            } catch {}
        }
    }, [scheduleId]);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // [v11.9.88] 날짜 유효성 검증 적용하여 Invalid Date로 인한 RangeError 크래시 원천 차단
    const checkIn = useMemo(() => {
        if (!schedule?.check_in) return new Date();
        const parsed = parseISO(schedule.check_in);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }, [schedule]);

    const checkOut = useMemo(() => {
        if (!schedule?.check_out) return new Date();
        const parsed = parseISO(schedule.check_out);
        return isNaN(parsed.getTime()) ? new Date() : parsed;
    }, [schedule]);

    const daysUntil = schedule ? differenceInDays(checkIn, today) : 999;
    const nights = schedule ? differenceInDays(checkOut, checkIn) : 0;
    const isWeatherEnabled = schedule ? (daysUntil <= 10) : false;

    const weather = useWeather(
        schedule?.campground_lat || undefined,
        schedule?.campground_lng || undefined,
        isWeatherEnabled
    );

    // 캠핑 기간의 날짜 리스트 생성 헬퍼
    const getDatesInRange = (startDate: Date, endDate: Date) => {
        const dates = [];
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const curr = new Date(startDate);
        const end = new Date(endDate);
        curr.setHours(0, 0, 0, 0);
        end.setHours(0, 0, 0, 0);
        while (curr <= end) {
            if (curr >= today) {
                dates.push(format(curr, 'yyyyMMdd'));
            }
            curr.setDate(curr.getDate() + 1);
        }
        return dates;
    };

    const datesInRange = schedule ? getDatesInRange(checkIn, checkOut) : [];

    const getWeatherIcon = (type: string) => {
        switch (type) {
            case 'sunny': return '☀️';
            case 'partly_cloudy': return '⛅';
            case 'cloudy': return '☁️';
            case 'rainy': return '☔';
            case 'snowy': return '❄️';
            default: return '🌤️';
        }
    };

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

        if (!isMountedRef.current) return;
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

                if (!isMountedRef.current) return;

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

        if (isMountedRef.current) {
            setMealRecommendations(mappedRecs as any);
        }
    }, [schedule, initialRecipeId]);

    useEffect(() => {
        if (schedule?.id) {
            fetchRecs();
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [schedule?.id]);

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

    // 데이터 로드 (서버 Action 1차 + 클라이언트 SDK 2차 백업 듀얼 폴백)
    const loadData = useCallback(async () => {
        try {
            let [scheduleData, checklistData] = await Promise.all([
                getScheduleById(scheduleId),
                getChecklist(scheduleId),
            ]);

            // [v11.9.120] 1차 Server Action 조회 실패 시 클라이언트 SDK 2차 백업 조회 (Dual-Fallback)
            if (!scheduleData) {
                try {
                    const supabase = createClient();
                    const { data: clientSchedule } = await supabase
                        .from('user_schedules')
                        .select('*')
                        .eq('id', scheduleId)
                        .maybeSingle();

                    if (clientSchedule) {
                        scheduleData = clientSchedule as Schedule;
                    }
                } catch (clientErr) {
                    console.warn('[ScheduleDetail] Client fallback fetch error:', clientErr);
                }
            }

            if (!isMountedRef.current) return;
            if (scheduleData) setSchedule(scheduleData);
            if (checklistData) setChecklist(checklistData);
        } catch (error) {
            console.error('Load schedule detail error:', error);
        } finally {
            if (isMountedRef.current) {
                setIsLoading(false);
            }
        }
    }, [scheduleId]);

    useEffect(() => {
        if (scheduleId && scheduleId !== 'undefined' && !isUserLoading) {
            loadData();
        }
    }, [loadData, isUserLoading, scheduleId]);

    // [v12.8.0] 예약건 단위 순수 새벽 캐싱 완료 여부 실시간 쿼리 (Server Action 안전 감지)
    useEffect(() => {
        if (scheduleId && scheduleId !== 'undefined') {
            async function checkCandidateCache() {
                try {
                    const isCachedResult = await checkCandidateCacheAction(scheduleId);
                    if (isMountedRef.current) {
                        setIsCached(isCachedResult);
                    }
                } catch (e) {
                    console.error('[ScheduleDetail] Check candidate cache error:', e);
                }
            }
            checkCandidateCache();
        }
    }, [scheduleId]);

    // [v13.3.0] 완전히 작성 완료된 정밀 플랜(wrapped: true & !isPreview)이 있는 경우에만 결과를 펼치고, 맛보기 상태는 정밀 버튼 100% 표출!
    useEffect(() => {
        if (schedule && !showProfileGate && !isReconstructing) {
            const savedData = schedule.smart_plan_data;
            const isPreview = (savedData as any)?.is_preview === true;
            
            if (savedData && (savedData as any).wrapped === true && !isPreview && !showSmartPlan) {
                const savedMode = (savedData as any).mode === 'PRO' ? 'PRO' : 'BASIC';
                setPlanMode(savedMode);
                setShowSmartPlan(true);
            } else if (!savedData) {
                async function initPreview() {
                    try {
                        const { generatePreviewSmartPlan } = await import('@/lib/smartPlan');
                        const loc = { 
                            lat: schedule!.campground_lat || 36.68, 
                            lng: schedule!.campground_lng || 126.84 
                        };
                        const start = schedule!.check_in ? new Date(schedule!.check_in) : new Date();
                        const end = schedule!.check_out ? new Date(schedule!.check_out) : new Date();
                        const previewPlan = await generatePreviewSmartPlan(loc, start, end, userId || schedule?.user_id);
                        setSchedule(prev => prev ? { ...prev, smart_plan_data: previewPlan } : null);

                        // [v13.1.0] 맛보기 플랜이 생성되면 is_preview: true 상태로 DB에 즉시 확정 저장!
                        if (schedule?.id) {
                            const { updateSmartPlanData } = await import('@/actions/schedule');
                            await updateSmartPlanData(schedule.id, previewPlan);
                        }
                    } catch (err) {
                        console.error('[ScheduleDetail] Preview plan init error:', err);
                    }
                }
                initPreview();
            }
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
            toast.success('여행 완료! 🏕️');
            router.push('/myspace/schedule');
        }
    };

    // 로딩 상태 (Route Param Gate: params.id가 준비 완료될 때까지 안전 대기 고정)
    if (!isMounted || isLoading || isUserLoading || !scheduleId || scheduleId === 'undefined') {
        return (
            <div className="min-h-screen bg-[#F7F5EF] flex items-center justify-center">
                <Loader2 className="w-8 h-8 text-[#224732] animate-spin" />
            </div>
        );
    }

    // 일정 없음 (자동 퇴장 트리거 전면 제거 & 뷰포트 고정)
    if (!schedule) {
        return (
            <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center p-6 text-center space-y-4">
                <div className="w-12 h-12 rounded-full bg-[#224732]/10 flex items-center justify-center text-[#224732] mb-2">
                    <Loader2 className="w-6 h-6 animate-spin" />
                </div>
                <h3 className="text-base font-bold text-gray-800">일정 정보를 준비 중입니다</h3>
                <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                    네트워크 연결이나 세션 동기화로 인해 일시적으로 지연되고 있습니다. 아래 버튼을 눌러 다시 불러올 수 있습니다.
                </p>
                <div className="flex gap-2 pt-2">
                    <Button 
                        onClick={() => loadData()} 
                        className="bg-[#224732] hover:bg-[#1a3626] text-white px-5 py-2 rounded-xl text-xs font-semibold"
                    >
                        다시 불러오기
                    </Button>
                    <Button 
                        onClick={() => router.push('/myspace/schedule')} 
                        variant="outline"
                        className="border-gray-300 text-gray-700 px-5 py-2 rounded-xl text-xs font-semibold"
                    >
                        일정 목록으로
                    </Button>
                </div>
            </div>
        );
    }

    const checkedCount = checklist.filter(i => i.is_checked).length;


    return (
        <div className="min-h-screen bg-[#F7F5EF]">
            {/* 헤더 */}
            <div className="sticky top-0 z-10 bg-white border-b border-gray-100">
                <div className="flex items-center justify-between px-4 h-14">
                    <button
                        onClick={() => {
                            try { window.sessionStorage?.setItem('raonai_back_from_detail', 'true'); } catch {}
                            if (typeof window !== 'undefined' && window.history.length > 1) {
                                router.back();
                            } else {
                                router.push('/myspace/schedule');
                            }
                        }}
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
                                완료된 여행
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

                {/* 날씨 정보 */}
                {daysUntil > 10 ? (
                    <div className="bg-white rounded-2xl p-4 shadow-sm text-center py-6">
                        <span className="text-3xl block mb-2">🌤️</span>
                        <p className="font-semibold text-gray-900 text-sm">여행 날씨 정보 대기 중</p>
                        <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                            출발 10일 전부터 기상청 예보를 실시간으로 받아와<br />
                            여행 일정 내의 날씨 정보가 여기에 표시됩니다.
                        </p>
                    </div>
                ) : weather.loading ? (
                    <div className="bg-white rounded-2xl p-4 shadow-sm animate-pulse space-y-3">
                        <div className="h-4 w-32 bg-stone-100 rounded" />
                        <div className="flex gap-3">
                            <div className="flex-1 h-16 bg-stone-100 rounded-xl" />
                            <div className="flex-1 h-16 bg-stone-100 rounded-xl" />
                            <div className="flex-1 h-16 bg-stone-100 rounded-xl" />
                        </div>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
                        <div className="flex items-center justify-between text-xs border-b border-gray-100 pb-2">
                            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                                <span className="text-base">🏕️</span> 여행 전체일정 날씨 예보
                            </h3>
                            {weather.lastUpdated && (
                                <span className="text-[10px] text-gray-400">
                                    업데이트: {format(weather.lastUpdated, 'HH:mm')}
                                </span>
                            )}
                        </div>
                        <div className="flex gap-2.5 overflow-x-auto py-1 scrollbar-hide">
                            {datesInRange.map(dateStr => {
                                const dayFcst = weather.daily?.find(d => d.date === dateStr);
                                const formattedDate = `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`;

                                return (
                                    <div key={dateStr} className="flex-1 min-w-[65px] flex flex-col items-center p-2 rounded-xl bg-gray-50/50 border border-gray-100">
                                        <span className="text-[10px] font-medium text-gray-500">{formattedDate}</span>
                                        {dayFcst ? (
                                            <>
                                                <span className="text-xl my-1">{getWeatherIcon(dayFcst.weatherCode)}</span>
                                                <span className="text-xs font-semibold text-gray-700">
                                                    {dayFcst.min !== null && dayFcst.max !== null ? `${Math.round(dayFcst.min)}°/${Math.round(dayFcst.max)}°` : '-'}
                                                </span>
                                                {dayFcst.pop > 0 && (
                                                    <span className="text-[9px] text-blue-500 font-bold mt-0.5">{dayFcst.pop}%</span>
                                                )}
                                            </>
                                        ) : (
                                            <>
                                                <span className="text-xl my-1 text-gray-300">⏳</span>
                                                <span className="text-[9px] text-gray-400 font-medium">대기</span>
                                            </>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                {/* 스마트 여행 플랜 UI (통합 단일 CTA 구조) */}
                <div className="mt-6 mb-4">
                    {(() => {
                        const isPreviewMode = (schedule.smart_plan_data as any)?.is_preview === true;
                        const handleTriggerGeneration = (targetMode?: 'BASIC' | 'PRO') => {
                            if (targetMode === 'PRO') {
                                setPlanMode('PRO');
                            } else {
                                setPlanMode('BASIC');
                            }
                            setShowProfileGate(true);
                        };

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
                                            setIsReconstructing(true);
                                            // [v11.9.75] 실제 클릭한 모드가 PRO일 때만 모드 선택기 작동
                                            if (planMode === 'PRO') {
                                                setShowModeSelector(true);
                                            } else {
                                                setPlanMode('BASIC');
                                                setShowSmartPlan(true);
                                            }
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

                        // PRO 모드 선택기 표시 중
                        if (showModeSelector) {
                            return (
                                <div className="space-y-3">
                                    <SmartPlanModeSelector
                                        onSelect={(type) => {
                                            setTravelType(type);
                                            setPlanMode('PRO');
                                            setShowModeSelector(false);
                                            setShowSmartPlan(true);
                                        }}
                                    />
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => {
                                            setShowModeSelector(false);
                                            // Basic으로 폴백
                                            setPlanMode('BASIC');
                                            setShowSmartPlan(true);
                                        }}
                                        className="w-full text-gray-400 text-[11px] hover:bg-transparent"
                                    >
                                        Basic 모드로 생성하기
                                    </Button>
                                </div>
                            );
                        }

                        return (
                            <SmartPlanProposal
                                key={planKey}
                                scheduleId={schedule.id}
                                initialPlan={isReconstructing ? null : schedule.smart_plan_data}
                                isPreviewMode={isReconstructing ? false : isPreviewMode}
                                isCached={isCached}
                                userId={userId}
                                userEmail={userEmail}
                                liveWeather={weather}
                                location={{
                                    lat: schedule.campground_lat || 36.67,
                                    lng: schedule.campground_lng || 126.84
                                }}
                                startDate={checkIn}
                                endDate={checkOut}
                                origin={smartPlanOrigin}
                                mode={planMode}
                                travelType={travelType}
                                onTriggerGeneration={handleTriggerGeneration}
                                onReset={() => {
                                    setIsReconstructing(true);
                                    setShowSmartPlan(false);
                                    setShowProfileGate(false);
                                    setShowModeSelector(false);
                                    setPlanMode('BASIC');
                                    setPlanKey(prev => prev + 1);
                                }}
                                onGenerated={async () => {
                                    await loadData();
                                    setIsReconstructing(false);
                                }}
                            />
                        );
                    })()}
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

export default function ScheduleDetailPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center space-y-3 font-sans">
                <Loader2 className="w-8 h-8 text-[#224732] animate-spin" />
                <span className="text-xs text-stone-500 font-medium">일정을 상세히 불러오는 중...</span>
            </div>
        }>
            <ScheduleDetailContent />
        </Suspense>
    );
}
