'use client';

import { useState, useRef, useEffect } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

interface SiteImageSliderProps {
    imageUrls: string[];
    siteName: string;
    fallbackUrl: string;
}

export default function SiteImageSlider({ imageUrls, siteName, fallbackUrl }: SiteImageSliderProps) {
    const [activeIndex, setActiveIndex] = useState(0);
    const scrollContainerRef = useRef<HTMLDivElement>(null);

    // 상세화면 최초 마운트 시, 브라우저 스크롤을 무조건 최상단으로 강제 초기화 (Next.js 스크롤 복원 버그 가드)
    useEffect(() => {
        window.scrollTo({ top: 0, behavior: 'instant' });
    }, []);

    // 유효한 이미지 주소만 필터링 (빈 문자열 제거)
    const validImages = imageUrls.filter((url) => url && url.trim().length > 0);

    // 이미지가 없거나 1개인 경우 단일 이미지 렌더링 (안전한 폴백)
    if (validImages.length <= 1) {
        const singleUrl = validImages[0] || fallbackUrl;
        return (
            <div className="relative h-[40vh] w-full bg-stone-900">
                <Image
                    src={singleUrl}
                    alt={siteName}
                    fill
                    className="object-cover"
                    priority
                    unoptimized
                />
                <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#1a1a1a]" />
                <Link
                    href="/reservation"
                    className="absolute top-6 left-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-white/10 transition-colors z-20"
                >
                    <ArrowLeft className="w-6 h-6" />
                </Link>
            </div>
        );
    }

    const handleScroll = () => {
        const container = scrollContainerRef.current;
        if (!container) return;

        const width = container.offsetWidth;
        const scrollLeft = container.scrollLeft;
        // 미세오차 보정을 더해 정확히 매칭
        const newIndex = Math.round(scrollLeft / (width || 1));
        if (newIndex !== activeIndex && newIndex >= 0 && newIndex < validImages.length) {
            setActiveIndex(newIndex);
        }
    };

    return (
        <div className="relative h-[40vh] w-full bg-stone-900 overflow-hidden">
            {/* 가로 스크롤 스냅 컨테이너 */}
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                className="flex w-full h-full overflow-x-auto snap-x snap-mandatory scrollbar-none touch-pan-x"
                style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
            >
                {validImages.map((url, idx) => (
                    <div
                        key={idx}
                        className="w-full h-full flex-shrink-0 snap-start relative"
                    >
                        <Image
                            src={url}
                            alt={`${siteName} image ${idx + 1}`}
                            fill
                            className="object-cover"
                            priority={idx === 0}
                            unoptimized
                        />
                    </div>
                ))}
            </div>

            {/* 그라데이션 오버레이 */}
            <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-transparent to-[#1a1a1a] pointer-events-none" />

            {/* 뒤로가기 버튼 */}
            <Link
                href="/reservation"
                className="absolute top-6 left-4 p-2 bg-black/20 backdrop-blur-md rounded-full text-white hover:bg-white/10 transition-colors z-20"
            >
                <ArrowLeft className="w-6 h-6" />
            </Link>

            {/* 페이지 인디케이터 배지 (우측 하단) */}
            <div className="absolute bottom-12 right-5 bg-black/50 backdrop-blur-md border border-white/10 px-3 py-1 rounded-full text-xs text-white font-bold tracking-wider z-20 shadow-lg">
                {activeIndex + 1} / {validImages.length}
            </div>

            {/* 하단 점형 인디케이터 (Subtle) */}
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 z-20 pointer-events-none">
                {validImages.map((_, idx) => (
                    <span
                        key={idx}
                        className={`w-1.5 h-1.5 rounded-full transition-all duration-300 ${
                            idx === activeIndex
                                ? 'bg-[#C3A675] w-3'
                                : 'bg-white/40'
                        }`}
                    />
                ))}
            </div>
        </div>
    );
}
