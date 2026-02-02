'use client';

import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { ChevronRight, MapPin } from 'lucide-react';

interface PlanLockCardProps {
    hasActivePlan?: boolean;
    modeName?: string;
    campgroundName?: string;
    className?: string;
}

/**
 * 홈 화면에 표시되는 Plan Lock 카드
 * - 계획 없음: "다음 캠핑을 계획해 볼까요?"
 * - 계획 있음: 현재 모드/캠핑장 표시
 */
export function PlanLockCard({
    hasActivePlan = false,
    modeName,
    campgroundName,
    className,
}: PlanLockCardProps) {
    const router = useRouter();

    return (
        <button
            type="button"
            onClick={() => router.push('/planlock')}
            className={cn(
                'w-full p-4 rounded-2xl',
                'border border-brand-1/20 bg-gradient-to-br from-brand-1/5 to-brand-1/10',
                'flex items-center justify-between',
                'transition-all duration-200',
                'touch-manipulation active:scale-[0.98]',
                'hover:shadow-md hover:border-brand-1/30',
                className
            )}
        >
            <div className="flex items-center gap-3">
                {/* 아이콘 */}
                <div className="w-12 h-12 rounded-xl bg-brand-1/20 flex items-center justify-center">
                    <span className="text-2xl">🏕️</span>
                </div>

                {/* 텍스트 */}
                <div className="text-left">
                    {hasActivePlan ? (
                        <>
                            <p className="text-sm font-medium text-brand-1">
                                {modeName || '캠핑'} 모드
                            </p>
                            {campgroundName && (
                                <p className="text-base font-semibold text-gray-900 flex items-center gap-1">
                                    <MapPin className="w-4 h-4 text-gray-400" />
                                    {campgroundName}
                                </p>
                            )}
                        </>
                    ) : (
                        <>
                            <p className="text-sm text-gray-500">다음 캠핑지를 찾고 계세요?</p>
                            <p className="text-base font-semibold text-brand-1">
                                맞춤 캠핑장 추천받기 →
                            </p>
                        </>
                    )}
                </div>
            </div>

            {/* 화살표 */}
            <ChevronRight className="w-5 h-5 text-gray-400" />
        </button>
    );
}

export default PlanLockCard;
