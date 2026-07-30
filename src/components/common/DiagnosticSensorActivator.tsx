'use client';

import { useEffect } from 'react';
import { setupGlobalErrorListener } from '@/lib/diagnosticSensor';

export default function DiagnosticSensorActivator() {
    useEffect(() => {
        const cleanup = setupGlobalErrorListener();
        return () => {
            cleanup?.();
        };
    }, []);

    return null;
}
