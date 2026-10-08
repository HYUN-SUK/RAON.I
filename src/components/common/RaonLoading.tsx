'use client';

import React from 'react';
import { cn } from '@/lib/utils';

export interface RaonLoadingProps {
    /** 
     * 크기: 
     * - 'xs' (16px - 버튼 내부 인라인용, 높이 변형 0%)
     * - 'sm' (24px - 위젯/동기화 뱃지용)
     * - 'md' (40px - 카드/모달용)
     * - 'lg' (56px - 페이지/섹션 컨텐츠 로딩용)
     */
    size?: 'xs' | 'sm' | 'md' | 'lg';
    /** 로딩 안내 문구 (주로 md, lg에서 사용) */
    text?: string;
    /** 추가 CSS 클래스 */
    className?: string;
}

export default function RaonLoading({
    size = 'md',
    text,
    className
}: RaonLoadingProps) {
    const sizeConfig = {
        xs: {
            container: 'w-4 h-4',
            box: 16,
            radius: 6.5,
            strokeWidth: 1.8,
            circumference: 40.84,
            logo: 'w-2.5 h-2.5',
            shadow: '',
            border: '',
            textSize: 'text-[10px]'
        },
        sm: {
            container: 'w-6 h-6',
            box: 24,
            radius: 9.5,
            strokeWidth: 2.2,
            circumference: 59.69,
            logo: 'w-3.5 h-3.5',
            shadow: 'shadow-xs',
            border: 'border border-emerald-50/80',
            textSize: 'text-[11px]'
        },
        md: {
            container: 'w-10 h-10',
            box: 40,
            radius: 16,
            strokeWidth: 2.5,
            circumference: 100.53,
            logo: 'w-5.5 h-5.5',
            shadow: 'shadow-sm',
            border: 'border border-emerald-100/80',
            textSize: 'text-xs'
        },
        lg: {
            container: 'w-14 h-14',
            box: 56,
            radius: 23,
            strokeWidth: 3.0,
            circumference: 144.51,
            logo: 'w-8 h-8',
            shadow: 'shadow-[0_8px_24px_rgba(30,77,43,0.12)]',
            border: 'border border-emerald-100',
            textSize: 'text-sm'
        }
    }[size];

    return (
        <div className={cn("inline-flex flex-col items-center justify-center shrink-0", text ? "gap-2.5" : "", className)}>
            <div
                className={cn(
                    "relative rounded-full inline-flex items-center justify-center bg-white dark:bg-zinc-900 shrink-0 leading-none",
                    sizeConfig.container,
                    sizeConfig.shadow,
                    sizeConfig.border
                )}
            >
                {/* 회전하는 에메랄드 스피너 링 */}
                <svg
                    className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none animate-spin"
                    viewBox={`0 0 ${sizeConfig.box} ${sizeConfig.box}`}
                >
                    {/* 배경 링 */}
                    <circle
                        cx={sizeConfig.box / 2}
                        cy={sizeConfig.box / 2}
                        r={sizeConfig.radius}
                        fill="none"
                        stroke="#EAEFEA"
                        strokeWidth={sizeConfig.strokeWidth}
                        className="dark:stroke-zinc-800"
                    />
                    {/* 에메랄드 활성 트랙 */}
                    <circle
                        cx={sizeConfig.box / 2}
                        cy={sizeConfig.box / 2}
                        r={sizeConfig.radius}
                        fill="none"
                        stroke="#388E5A"
                        strokeWidth={sizeConfig.strokeWidth}
                        strokeLinecap="round"
                        strokeDasharray={sizeConfig.circumference}
                        strokeDashoffset={sizeConfig.circumference * 0.35}
                    />
                </svg>

                {/* 중앙 라온아이 공식 텐트 로고 */}
                <div className={cn("relative z-10 flex items-center justify-center pointer-events-none select-none", sizeConfig.logo)}>
                    <img
                        src="/icons/icon-192.png"
                        alt="라온아이"
                        width={sizeConfig.box}
                        height={sizeConfig.box}
                        className="w-full h-full object-contain pointer-events-none select-none"
                        loading="eager"
                        decoding="async"
                    />
                </div>
            </div>

            {text && (
                <p className={cn("font-bold text-stone-600 dark:text-stone-300 text-center tracking-tight animate-pulse", sizeConfig.textSize)}>
                    {text}
                </p>
            )}
        </div>
    );
}
