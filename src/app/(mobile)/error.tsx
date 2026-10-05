'use client';

import { useEffect } from 'react';
import { recordBounceLog } from '@/lib/diagnosticSensor';

export default function MobileError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // 튕김 원인을 정밀 기록
        recordBounceLog({
            source: 'error.tsx (Mobile Group Error Boundary)',
            reason: error?.message || 'Mobile Page Exception Thrown',
            fromUrl: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
            toUrl: 'Next.js Mobile Recovery (Home)',
            sessionExists: true,
            stackTrace: error?.stack || error?.digest || ''
        });

    }, [error]);

    return (
        <div className="min-h-screen bg-[#F8FAF8] flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
            <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2 animate-bounce">
                ⚠️
            </div>
            <h3 className="text-base font-bold text-gray-800">일시적인 오류가 발생했습니다</h3>
            <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                네트워크 연결이나 화면 준비 중 일시적인 지연이 발생했습니다.<br />
                아래 버튼을 눌러 다시 시도해 주세요.
            </p>
            <div className="flex gap-2.5 pt-2">
                <button
                    onClick={() => reset()}
                    className="bg-[#388E5A] hover:bg-[#2F774B] text-white text-xs px-5 py-2.5 rounded-xl font-semibold shadow-sm shadow-[#388E5A]/20 transition-all active:scale-95"
                >
                    다시 시도하기
                </button>
                <button
                    onClick={() => { window.location.href = '/'; }}
                    className="bg-white border border-gray-200 text-gray-700 hover:bg-gray-50 text-xs px-5 py-2.5 rounded-xl font-semibold shadow-xs transition-all active:scale-95"
                >
                    홈으로 이동
                </button>
            </div>
        </div>
    );
}
