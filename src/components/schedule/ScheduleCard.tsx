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
}

export default function ScheduleCard({
    schedule,
    onEdit,
    onDelete,
    onComplete,
    onClick,
}: ScheduleCardProps) {
    const [isMenuOpen, setIsMenuOpen] = useState(false);

    const checkIn = parseISO(schedule.check_in);
    const checkOut = parseISO(schedule.check_out);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysUntil = differenceInDays(checkIn, today);
    const nights = differenceInDays(checkOut, checkIn);

    // 스마트플랜 사용 가능 여부 판별 (예약 생성 다음날 오전 9시 이후 활성화)
    const isSmartPlanAvailable = useMemo(() => {
        if (schedule.smart_plan_data) return false;
        if (schedule.status !== 'scheduled') return false;

        const createdAtDate = new Date(schedule.created_at);
        if (isNaN(createdAtDate.getTime())) return false;

        const unlockTimeByCreation = new Date(createdAtDate);
        unlockTimeByCreation.setDate(unlockTimeByCreation.getDate() + 1);
        unlockTimeByCreation.setHours(9, 0, 0, 0);

        return new Date() >= unlockTimeByCreation;
    }, [schedule]);

    // 스마트플랜 오픈 대기 여부 판별 (예약 생성 다음날 오전 9시 이전 대기 상태)
    const isSmartPlanUnlockingSoon = useMemo(() => {
        if (schedule.smart_plan_data) return false;
        if (schedule.status !== 'scheduled') return false;

        const createdAtDate = new Date(schedule.created_at);
        if (isNaN(createdAtDate.getTime())) return false;

        const unlockTimeByCreation = new Date(createdAtDate);
        unlockTimeByCreation.setDate(unlockTimeByCreation.getDate() + 1);
        unlockTimeByCreation.setHours(9, 0, 0, 0);

        return new Date() < unlockTimeByCreation;
    }, [schedule]);

    // 스마트플랜 안내 문구/뱃지 결정 (홈화면 위젯과 100% 동일)
    const smartPlanMessage = useMemo(() => {
        if (schedule.smart_plan_data) {
            return '✨ 스마트플랜 생성 완료';
        }

        if (isSmartPlanUnlockingSoon) {
            const createdAtDate = new Date(schedule.created_at);
            const unlockTimeByCreation = new Date(createdAtDate);
            unlockTimeByCreation.setDate(unlockTimeByCreation.getDate() + 1);
            unlockTimeByCreation.setHours(9, 0, 0, 0);

            const now = new Date();
            const isUnlockDay = now.getFullYear() === unlockTimeByCreation.getFullYear() &&
                                now.getMonth() === unlockTimeByCreation.getMonth() &&
                                now.getDate() === unlockTimeByCreation.getDate();

            return isUnlockDay 
                ? "⏰ 오늘 오전 9시부터 계획 생성 가능"
                : "⏰ 내일 오전 9시부터 계획 생성 가능";
        }

        if (isSmartPlanAvailable) {
            if (daysUntil <= 7 && daysUntil >= 0) {
                return '✨ 최종 날씨반영계획 생성가능';
            } else if (daysUntil > 7) {
                return '✨ 여행계획 세우기 가능';
            }
        }

        return null;
    }, [schedule, isSmartPlanAvailable, isSmartPlanUnlockingSoon, daysUntil]);

    // D-Day 텍스트
    const getDDayText = () => {
        if (schedule.status === 'completed') return '완료';
        if (schedule.status === 'cancelled') return '취소됨';
        if (daysUntil < 0) return '지난 일정';
        if (daysUntil === 0) return 'D-Day';
        if (daysUntil <= 7) return `D-${daysUntil}`;
        return null;
    };

    // D-Day 배지 색상
    const getDDayColor = () => {
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
                    "mb-3 text-[11px] font-bold px-2.5 py-1.5 rounded-xl w-fit flex items-center gap-1.5",
                    schedule.smart_plan_data 
                        ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-400 border border-emerald-100 dark:border-emerald-900/50"
                        : isSmartPlanUnlockingSoon
                            ? "bg-amber-50 text-amber-700 dark:bg-amber-950/30 dark:text-amber-400 border border-amber-100 dark:border-amber-900/50"
                            : "bg-orange-50 text-orange-700 dark:bg-orange-950/30 dark:text-orange-400 border border-orange-100 dark:border-orange-900/50 animate-pulse"
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
            {onClick && (
                <div className="mt-3 pt-3 border-t border-gray-100 flex items-center justify-end">
                    <span className="text-sm text-[#224732] font-medium flex items-center gap-0.5">
                        상세보기
                        <ChevronRight className="w-4 h-4" />
                    </span>
                </div>
            )}
        </div>
    );
}
