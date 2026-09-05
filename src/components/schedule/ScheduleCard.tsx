'use client';

import { useState, useMemo } from 'react';
import { format, differenceInDays, parseISO } from 'date-fns';
import { ko } from 'date-fns/locale';
import {
    MapPin,
    Calendar,
    Clock,
    ChevronRight,
    MoreVertical,
    CheckCircle,
    Trash2,
    Edit
} from 'lucide-react';
import { Schedule } from '@/actions/schedule';
import { cn } from '@/lib/utils';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface ScheduleCardProps {
    schedule: Schedule;
    onEdit?: (schedule: Schedule) => void;
    onDelete?: (scheduleId: string) => void;
    onComplete?: (scheduleId: string) => void;
    onClick?: (schedule: Schedule) => void;
    onCancelRequest?: (schedule: Schedule) => void;
}

export default function ScheduleCard({
    schedule,
    onEdit,
    onDelete,
    onComplete,
    onClick,
    onCancelRequest,
}: ScheduleCardProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const checkIn = parseISO(schedule.check_in);
    const checkOut = parseISO(schedule.check_out);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysUntil = differenceInDays(checkIn, today);
    const nights = differenceInDays(checkOut, checkIn);

    // 스마트플랜 사용 가능 여부 판별 (예약 생성 새벽 5시 이전 당일 9시, 이후 다음날 오전 9시 활성화)
    const isSmartPlanAvailable = useMemo(() => {
        if (schedule.status !== 'scheduled') return false;

        const createdAtDate = new Date(schedule.created_at);
        if (isNaN(createdAtDate.getTime())) return false;

        const unlockTimeByCreation = new Date(createdAtDate);
        if (createdAtDate.getHours() < 5) {
            unlockTimeByCreation.setHours(9, 0, 0, 0);
        } else {
            unlockTimeByCreation.setDate(unlockTimeByCreation.getDate() + 1);
            unlockTimeByCreation.setHours(9, 0, 0, 0);
        }

        return new Date() >= unlockTimeByCreation;
    }, [schedule]);

    // [v13.7.0] 스마트플랜 5단계 동적 D-Day 생명주기 뱃지 수식
    const smartPlanMessage = useMemo(() => {
        if ((schedule as any).is_pending_reservation) {
            return null;
        }

        const hasPlanData = !!schedule.smart_plan_data;
        const isPreviewPlan = (schedule.smart_plan_data as any)?.is_preview === true;
        const weatherWindow = (schedule.smart_plan_data as any)?.weather_window || 'NONE';

        // 5단계: 사용자가 정밀/업데이트 플랜 작성을 완전히 완료한 경우
        if (hasPlanData && !isPreviewPlan) {
            if (daysUntil <= 0) {
                if (weatherWindow !== 'SHORT') {
                    return '⚡ 당일 정밀날씨 업데이트 가능';
                }
                return '✨ 출발 당일 플랜 최신화 완료';
            }
            if (daysUntil <= 7 && daysUntil >= 1) {
                if (weatherWindow === 'NONE') {
                    return '🌤️ 날씨정보 업데이트 가능';
                }
                return '✨ 주간 예보 업데이트 완료';
            }
            return '✨ 스마트플랜 생성 완료';
        }

        // 3/4단계: DB 캐싱 완료 & 오전 9시 도달 시 (정밀 스마트플랜 생성 관문)
        if (isSmartPlanAvailable) {
            if (daysUntil <= 0) {
                return '⚡ 당일 정밀날씨 업데이트 가능';
            }
            if (daysUntil <= 7 && daysUntil >= 1) {
                return '🌤️ 날씨정보 업데이트 가능';
            }
            return '✨ 정밀 스마트플랜 생성가능';
        }

        // 2단계: 즉시 여행계획이 이미 생성된 상태 (~ 오전 9시 전)
        if (hasPlanData && isPreviewPlan) {
            return '⚡ 즉시 여행계획 생성 완료';
        }

        // 1단계: 즉시 여행계획 생성 전 (신규 등록 직후)
        return "⚡ 즉시 여행계획 생성가능!, 터치해보세요!";
    }, [schedule, isSmartPlanAvailable, daysUntil]);

    // D-Day 텍스트
    const getDDayText = () => {
        if ((schedule as any).is_pending_reservation) return '입금 대기';
        if (schedule.status === 'completed') return '완료';
        if (schedule.status === 'cancelled') return '취소됨';
        if (daysUntil < 0) return '지난 일정';
        if (daysUntil === 0) return 'D-Day';
        if (daysUntil <= 7) return `D-${daysUntil}`;
        return null;
    };

    // D-Day 배지 색상
    const getDDayColor = () => {
        if ((schedule as any).is_pending_reservation) return 'bg-yellow-500 text-white animate-pulse';
        if (schedule.status === 'completed') return 'bg-[#224732] text-white';
        if (schedule.status === 'cancelled') return 'bg-gray-400 text-white';
        if (daysUntil < 0) return 'bg-gray-300 text-gray-600';
        if (daysUntil === 0) return 'bg-amber-500 text-white';
        if (daysUntil <= 3) return 'bg-orange-500 text-white';
        if (daysUntil <= 7) return 'bg-blue-500 text-white';
        return 'bg-gray-200 text-gray-700';
    };

    const ddayText = getDDayText();

    return (
        <div
            className={cn(
                "bg-white rounded-2xl p-4 shadow-sm border border-gray-100",
                (schedule as any).is_pending_reservation && "border-yellow-200 bg-yellow-50/10 shadow-sm",
                "transition-all duration-200 hover:shadow-md",
                onClick && "cursor-pointer"
            )}
            onClick={() => onClick?.(schedule)}
        >
            {/* 상단: 캠핑장명 + D-Day 배지 */}
            <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0 mr-2">
                    <div className="flex items-center gap-2 mb-1">
                        {schedule.source === 'raonai' && (
                            <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-[#224732]/10 text-[#224732]">
                                라온아이
                            </span>
                        )}
                        {ddayText && (
                            <span className={cn(
                                "inline-flex items-center px-2 py-0.5 rounded-full text-xs font-bold",
                                getDDayColor()
                            )}>
                                {ddayText}
                            </span>
                        )}
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900 truncate">
                        {schedule.campground_name}
                    </h3>
                </div>

                {/* 메뉴 */}
                <DropdownMenu open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                    <DropdownMenuTrigger
                        className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <MoreVertical className="w-5 h-5 text-gray-400" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-40">
                        {onEdit && schedule.status === 'scheduled' && (
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onEdit(schedule); }}
                                className="gap-2"
                            >
                                <Edit className="w-4 h-4" />
                                수정하기
                            </DropdownMenuItem>
                        )}
                        {onComplete && schedule.status === 'scheduled' && daysUntil <= 0 && (
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onComplete(schedule.id); }}
                                className="gap-2 text-[#224732]"
                            >
                                <CheckCircle className="w-4 h-4" />
                                완료하기
                            </DropdownMenuItem>
                        )}
                        {onDelete && (
                            <DropdownMenuItem
                                onClick={(e) => { e.stopPropagation(); onDelete(schedule.id); }}
                                className="gap-2 text-red-600"
                            >
                                <Trash2 className="w-4 h-4" />
                                삭제하기
                            </DropdownMenuItem>
                        )}
                    </DropdownMenuContent>
                </DropdownMenu>
            </div>

            {/* 주소 */}
            {schedule.campground_address && (
                <div className="flex items-center gap-1.5 text-sm text-gray-500 mb-3">
                    <MapPin className="w-4 h-4 flex-shrink-0" />
                    <span className="truncate">{schedule.campground_address}</span>
                </div>
            )}

            {/* 스마트플랜 안내 배지 */}
            {smartPlanMessage && (
                <div className={cn(
                    "mb-3 text-[11px] font-bold px-2.5 py-1.5 rounded-xl w-fit flex items-center gap-1.5 shadow-sm",
                    smartPlanMessage.includes('완료')
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50"
                        : smartPlanMessage.includes('정밀')
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50 animate-pulse"
                            : "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800"
                )}>
                    {smartPlanMessage}
                </div>
            )}

            {/* 일정 정보 */}
            <div className="flex items-center gap-4 text-sm">
                <div className="flex items-center gap-1.5 text-gray-700">
                    <Calendar className="w-4 h-4 text-[#224732]" />
                    <span>
                        {format(checkIn, 'M.d(EEE)', { locale: ko })} ~ {format(checkOut, 'M.d(EEE)', { locale: ko })}
                    </span>
                </div>
                <div className="flex items-center gap-1 text-gray-500">
                    <Clock className="w-4 h-4" />
                    <span>{nights}박</span>
                </div>
            </div>

            {/* 메모 */}
            {schedule.memo && (
                <p className="mt-3 text-sm text-gray-600 bg-gray-50 rounded-lg p-2.5 line-clamp-2">
                    {schedule.memo}
                </p>
            )}

            {/* 하단 링크 */}
            {(onClick || (schedule.source === 'raonai' && onCancelRequest && schedule.status === 'scheduled')) && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-between">
                    {schedule.source === 'raonai' && onCancelRequest && schedule.status === 'scheduled' ? (
                        <button
                            type="button"
                            onClick={(e) => {
                                e.stopPropagation();
                                onCancelRequest(schedule);
                            }}
                            className="text-xs text-red-500 font-semibold hover:text-red-700 active:scale-95 transition-all py-1 px-2 -ml-2 rounded-lg hover:bg-red-50"
                        >
                            취소요청
                        </button>
                    ) : (
                        <div />
                    )}
                    {onClick && !(schedule as any).is_pending_reservation && (
                        <span className="text-sm text-[#224732] font-semibold flex items-center gap-1 group">
                            <span className="inline-block animate-bounce text-xs">👆</span>
                            <span>상세보기</span>
                            <ChevronRight className="w-4 h-4 transition-transform group-hover:translate-x-0.5" />
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}
