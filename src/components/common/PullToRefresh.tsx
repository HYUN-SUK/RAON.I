'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Loader2, ArrowDown } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface PullToRefreshProps {
    children: React.ReactNode;
}

const PULL_THRESHOLD = 65; // 새로고침 발동 임계값 (px)
const MAX_PULL = 90; // 최대 당김 거리 (px)

export default function PullToRefresh({ children }: PullToRefreshProps) {
    const router = useRouter();
    const [pullDistance, setPullDistance] = useState(0);
    const [isRefreshing, setIsRefreshing] = useState(false);
    const [canPull, setCanPull] = useState(false);

    const startYRef = useRef(0);
    const startXRef = useRef(0);
    const isPullingRef = useRef(false);
    const pullDistanceRef = useRef(0);
    pullDistanceRef.current = pullDistance;

    // 모달, 시트, 지도 등 제스처 충돌 요소를 터치했는지 검사하는 안전 함수
    const isExcludedElement = (target: EventTarget | null): boolean => {
        if (!target || !(target instanceof HTMLElement)) return false;
        // 모달 다이얼로그, 바텀시트, 맵 캔버스, 드래그 영역 제외
        return !!target.closest(
            '[role="dialog"], [data-radix-portal], .kakao-map, canvas, [data-prevent-pull], input, textarea, select'
        );
    };

    const handleTouchStart = useCallback((e: TouchEvent) => {
        if (isRefreshing) return;

        // 1. 화면 스크롤이 정확히 0 (최상단)일 때만 활성화
        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        if (scrollTop > 2) {
            setCanPull(false);
            return;
        }

        // 2. 모달, 시트, 지도 터치 시 비활성화
        if (isExcludedElement(e.target)) {
            setCanPull(false);
            return;
        }

        const touch = e.touches[0];
        startYRef.current = touch.clientY;
        startXRef.current = touch.clientX;
        isPullingRef.current = false;
        setCanPull(true);
    }, [isRefreshing]);

    const handleTouchMove = useCallback((e: TouchEvent) => {
        if (!canPull || isRefreshing) return;

        const scrollTop = window.scrollY || document.documentElement.scrollTop || 0;
        if (scrollTop > 2) {
            setPullDistance(0);
            return;
        }

        const touch = e.touches[0];
        const deltaY = touch.clientY - startYRef.current;
        const deltaX = touch.clientX - startXRef.current;

        // 수평 스와이프보다 수직 당김이 확실히 클 때만 작동 (가로 캐러셀/슬라이더 간섭 방지)
        if (deltaY > 10 && deltaY > Math.abs(deltaX) * 1.5) {
            isPullingRef.current = true;
            // 부드러운 고무줄 텐션(스프링 감쇠) 적용
            const distance = Math.min(Math.pow(deltaY, 0.85) * 1.6, MAX_PULL);
            setPullDistance(distance);

            // 네이티브 화면 바운스 교란 방지
            if (e.cancelable && distance > 15) {
                e.preventDefault();
            }
        }
    }, [canPull, isRefreshing]);

    const handleTouchEnd = useCallback(() => {
        if (!canPull || isRefreshing) return;

        const currentPull = pullDistanceRef.current;
        setCanPull(false);
        isPullingRef.current = false;

        if (currentPull >= PULL_THRESHOLD) {
            // 새로고침 임계값 도달 ➔ 미세 진동 및 새로고침 실행
            try {
                if (typeof window !== 'undefined' && 'vibrate' in navigator) {
                    navigator.vibrate(18);
                }
            } catch {}

            setIsRefreshing(true);
            setPullDistance(PULL_THRESHOLD);

            setTimeout(() => {
                // Next.js 라우터 및 전체 페이지 최신화
                try {
                    router.refresh();
                } catch {}

                setTimeout(() => {
                    window.location.reload();
                }, 400);
            }, 300);
        } else {
            // 임계값 미달 ➔ 부드럽게 원위치
            setPullDistance(0);
        }
    }, [canPull, isRefreshing, router]);

    useEffect(() => {
        const options: AddEventListenerOptions = { passive: false };

        window.addEventListener('touchstart', handleTouchStart, { passive: true });
        window.addEventListener('touchmove', handleTouchMove, options);
        window.addEventListener('touchend', handleTouchEnd, { passive: true });
        window.addEventListener('touchcancel', handleTouchEnd, { passive: true });

        return () => {
            window.removeEventListener('touchstart', handleTouchStart);
            window.removeEventListener('touchmove', handleTouchMove);
            window.removeEventListener('touchend', handleTouchEnd);
            window.removeEventListener('touchcancel', handleTouchEnd);
        };
    }, [handleTouchStart, handleTouchMove, handleTouchEnd]);

    const isTriggerReady = pullDistance >= PULL_THRESHOLD;

    return (
        <>
            {/* 당겨서 새로고침 인디케이터 (상단 중앙 플로팅 링) */}
            <div
                className={`fixed left-1/2 -translate-x-1/2 z-[10000] pointer-events-none transition-all ${
                    isPullingRef.current ? 'duration-75' : 'duration-300 ease-out'
                }`}
                style={{
                    top: `calc(var(--sat, 0px) + ${Math.max(pullDistance - 10, -50)}px)`,
                    opacity: pullDistance > 10 ? Math.min((pullDistance - 10) / 30, 1) : 0,
                    transform: `translateX(-50%) scale(${Math.min(0.7 + (pullDistance / PULL_THRESHOLD) * 0.35, 1.05)})`,
                }}
            >
                <div
                    className={`w-10 h-10 rounded-full flex items-center justify-center shadow-xl border transition-all ${
                        isTriggerReady || isRefreshing
                            ? 'bg-[#388E5A] border-emerald-600 text-white shadow-emerald-900/20'
                            : 'bg-white border-stone-200 text-stone-600 shadow-stone-900/10'
                    }`}
                >
                    {isRefreshing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <ArrowDown
                            className="w-5 h-5 transition-transform duration-200"
                            style={{
                                transform: `rotate(${Math.min((pullDistance / PULL_THRESHOLD) * 180, 180)}deg)`,
                            }}
                        />
                    )}
                </div>
            </div>

            {/* 실제 페이지 본문 컨텐츠 */}
            {children}
        </>
    );
}
