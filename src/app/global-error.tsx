'use client';

import { useEffect } from 'react';
import { recordBounceLog } from '@/lib/diagnosticSensor';

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        // 튕김 원인을 정밀 기록
        recordBounceLog({
            source: 'global-error.tsx (Root Error Boundary)',
            reason: error?.message || 'Global Layout Exception Thrown',
            fromUrl: typeof window !== 'undefined' ? window.location.pathname + window.location.search : '',
            toUrl: 'Next.js Global Recovery (Home)',
            sessionExists: true,
            stackTrace: error?.stack || error?.digest || ''
        });

        // 즉시 홈화면으로 리다이렉트 (안전한 복구)
        if (typeof window !== 'undefined') {
            const timer = setTimeout(() => {
                window.location.replace('/');
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [error]);

    return (
        <html lang="ko">
            <body>
                <div className="min-h-screen bg-[#F7F5EF] flex flex-col items-center justify-center p-6 text-center space-y-4 font-sans">
                    <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center text-red-600 mb-2 animate-bounce">
                        ⚠️
                    </div>
                    <h3 className="text-base font-bold text-gray-800">죄송합니다. 서비스 로딩 중 오류가 발생했습니다.</h3>
                    <p className="text-xs text-gray-500 max-w-xs leading-relaxed">
                        안전한 복구를 위해 홈화면으로 이동하고 있습니다.
                    </p>
                    <button
                        onClick={() => reset()}
                        className="bg-[#224732] text-white text-xs px-4 py-2 rounded-xl font-semibold"
                    >
                        다시 시도하기
                    </button>
                </div>
            </body>
        </html>
    );
}
