'use client';

/**
 * 🚨 [임시 진단 센서] 튕김 원인 추적 라이브러리
 * - 화면 이동/리다이렉트 발생 시 소스 파일, 줄 번호, 원인을 sessionStorage에 기록합니다.
 * - 진단 완료 후 100% 원상 복구 및 삭제되는 임시 코드입니다.
 */

export interface BounceLog {
    timestamp: string;
    source: string; // 예: "ScheduleDetailPage.tsx:L360"
    reason: string; // 예: "getScheduleById returned null"
    fromUrl: string; // 예: "/myspace/schedule/sched_123"
    toUrl: string; // 예: "/"
    sessionExists: boolean;
    userEmail?: string | null;
    stackTrace?: string;
}

const STORAGE_KEY = 'raonai_bounce_debug_log';

/**
 * 튕김/리다이렉트 원인을 저장합니다.
 */
export function recordBounceLog(log: Omit<BounceLog, 'timestamp'>) {
    if (typeof window === 'undefined') return;

    try {
        const fullLog: BounceLog = {
            ...log,
            timestamp: new Date().toLocaleTimeString('ko-KR', { hour12: false }) + '.' + new Date().getMilliseconds(),
            stackTrace: new Error().stack?.split('\n').slice(2, 6).join('\n') || ''
        };

        const existingRaw = window.sessionStorage.getItem(STORAGE_KEY);
        const existingList: BounceLog[] = existingRaw ? JSON.parse(existingRaw) : [];
        
        // 최근 10개만 보존
        const updatedList = [fullLog, ...existingList].slice(0, 10);
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(updatedList));

        console.warn('🚨 [Bounce Diagnostic Sensor Logged]', fullLog);
    } catch (e) {
        console.error('Failed to record bounce log:', e);
    }
}

/**
 * 저장된 튕김 로그 목록을 반환합니다.
 */
export function getBounceLogs(): BounceLog[] {
    if (typeof window === 'undefined') return [];
    try {
        const raw = window.sessionStorage.getItem(STORAGE_KEY);
        return raw ? JSON.parse(raw) : [];
    } catch {
        return [];
    }
}

/**
 * 튕김 로그를 삭제합니다.
 */
export function clearBounceLogs() {
    if (typeof window === 'undefined') return;
    try {
        window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {}
}
