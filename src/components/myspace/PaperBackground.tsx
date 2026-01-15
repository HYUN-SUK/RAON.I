"use client";

import React from 'react';

interface PaperBackgroundProps {
    children: React.ReactNode;
    className?: string;
}

/**
 * 종이 질감 배경 래퍼 컴포넌트
 * - Inline SVG 노이즈 패턴 사용 (추가 네트워크 요청 없음)
 * - GPU 가속 렌더링
 * - "내 수첩" 컨셉에 맞는 아날로그 감성
 */
export default function PaperBackground({ children, className = '' }: PaperBackgroundProps) {
    return (
        <div
            className={`relative min-h-screen ${className}`}
            style={{
                background: `
                    linear-gradient(180deg, #FAF8F5 0%, #F5F2ED 100%)
                `,
            }}
        >
            {/* 종이 노이즈 텍스처 오버레이 */}
            <div
                className="pointer-events-none absolute inset-0 opacity-[0.03]"
                style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 200 200' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noiseFilter'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noiseFilter)'/%3E%3C/svg%3E")`,
                    backgroundRepeat: 'repeat',
                }}
            />

            {/* 종이 가장자리 그림자 효과 */}
            <div
                className="pointer-events-none absolute inset-0"
                style={{
                    boxShadow: 'inset 0 0 60px rgba(139, 119, 101, 0.08)',
                }}
            />

            {/* 콘텐츠 */}
            <div className="relative z-10">
                {children}
            </div>
        </div>
    );
}
