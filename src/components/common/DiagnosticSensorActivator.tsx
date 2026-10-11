'use client';

import { useEffect, useRef } from 'react';
import { setupGlobalErrorListener } from '@/lib/diagnosticSensor';
import { createClient } from '@/lib/supabase-client';

const IDLE_PREWARM_THRESHOLD_MS = 3 * 60 * 1000; // 3분

export default function DiagnosticSensorActivator() {
    const lastHiddenAtRef = useRef<number | null>(null);

    useEffect(() => {
        const cleanup = setupGlobalErrorListener();

        // [세션 Pre-warming] 3분 이상 자리 비운 뒤 화면 복귀 시 클릭 전에 미리 백그라운드에서 세션 토큰 갱신
        const handleVisibilityChange = () => {
            if (document.visibilityState === 'hidden') {
                lastHiddenAtRef.current = Date.now();
            } else if (document.visibilityState === 'visible') {
                const hiddenAt = lastHiddenAtRef.current;
                lastHiddenAtRef.current = null;
                if (hiddenAt && Date.now() - hiddenAt >= IDLE_PREWARM_THRESHOLD_MS) {
                    try {
                        const supabase = createClient();
                        supabase.auth.getSession().catch(() => {});
                    } catch {}
                }
            }
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);
        return () => {
            cleanup?.();
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return null;
}

