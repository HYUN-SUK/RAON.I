'use client';

/**
 * 🚨 [임시 진단 센서 v2] 튕김 원인 추적 라이브러리 (하드 새로고침 내성 강화)
 * - localStorage 및 window.onerror / onunhandledrejection 전역 포획 센서 적용.
 */

export interface BounceLog {
    timestamp: string;
    source: string;
    reason: string;
    fromUrl: string;
    toUrl: string;
    sessionExists: boolean;
    userEmail?: string | null;
    stackTrace?: string;
}

const STORAGE_KEY = 'raonai_bounce_debug_log_v2';

export function recordBounceLog(log: Omit<BounceLog, 'timestamp'>) {
    if (typeof window === 'undefined') return;

    try {
        const fullLog: BounceLog = {
            ...log,
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }) + '.' + new Date().getMilliseconds(),
            stackTrace: log.stackTrace || (new Error().stack?.split('\n').slice(2, 6).join('\n') || '')
        };

        // localStorage 사용으로 하드 새로고침 보존
        const existingRaw = window.localStorage.getItem(STORAGE_KEY);
        const existingList: BounceLog[] = existingRaw ? JSON.parse(existingRaw) : [];
        
        const updatedList = [fullLog, ...existingList].slice(0, 15);
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

        console.warn('🚨 [Bounce Diagnostic Sensor Logged]', fullLog);
    } catch (e) {
        console.error('Failed to record bounce log:', e);
    }
}

export function getBounceLogs(): BounceLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

export function clearBounceLogs() {
    if (typeof window === 'undefined') return;
    try {
        window.localStorage.removeItem(STORAGE_KEY);
    } catch {}
}

/**
 * 전역 런타임 자바스크립트 크래시 자동 포획 센서 등록
 */
if (typeof window !== 'undefined') {
    window.addEventListener('error', (event) => {
        recordBounceLog({
            source: `${event.filename || 'Unknown'}:L${event.lineno}:${event.colno}`,
            reason: `[Fatal JS Error] ${event.message}`,
            fromUrl: window.location.pathname,
            toUrl: 'CRASH',
            sessionExists: false,
            stackTrace: event.error?.stack || ''
        });
    });

    window.addEventListener('unhandledrejection', (event) => {
        recordBounceLog({
            source: 'PromiseRejection',
            reason: `[Unhandled Promise Rejection] ${event.reason?.message || String(event.reason)}`,
            fromUrl: window.location.pathname,
            toUrl: 'CRASH',
            sessionExists: false,
            stackTrace: event.reason?.stack || ''
        });
    });
}
