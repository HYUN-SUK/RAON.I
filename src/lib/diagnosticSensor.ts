'use client';

/**
 * 🚨 [정밀 진단 센서] 튕김 원인 추적 라이브러리
 * - 전역 자바스크립트 런타임 에러(TypeError 등)가 발생해 새로고침되기 직전의 StackTrace와 에러 원인을 sessionStorage에 영구 기록합니다.
 */

export interface BounceLog {
    timestamp: string;
    source: string; // 예: "ScheduleDetailPage.tsx"
    reason: string; // 예: "TypeError: Cannot read properties of undefined (reading 'LatLng')"
    fromUrl: string; // 예: "/myspace/schedule/123"
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
            stackTrace: log.stackTrace || new Error().stack?.split('\n').slice(2, 8).join('\n') || ''
        };

        const existingRaw = window.sessionStorage.getItem(STORAGE_KEY);
        const existingList: BounceLog[] = existingRaw ? JSON.parse(existingRaw) : [];
        
        // 중복 방지 (직전 로그와 동일하면 스킵)
        if (existingList.length > 0 && existingList[0].reason === fullLog.reason && existingList[0].fromUrl === fullLog.fromUrl) {
            return;
        }

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

/**
 * 전역 자바스크립트 에러, Promise Rejection 및 무음 라우팅 리다이렉트(Navigation Interceptor) 감지기 활성화
 */
export function setupGlobalErrorListener() {
    if (typeof window === 'undefined') return;

    // 1. 잡히지 않은 일반 JS 런타임 에러 감지
    const handleError = (event: ErrorEvent) => {
        try {
            const error = event.error;
            const message = error?.message || event.message || 'Unknown Error';
            const stack = error?.stack || '';
            const filename = event.filename ? event.filename.split('/').pop() : 'Unknown File';
            const lineno = event.lineno;
            const colno = event.colno;

            recordBounceLog({
                source: `${filename}:${lineno}:${colno}`,
                reason: `JS Error: ${message}`,
                fromUrl: window.location.pathname + window.location.search,
                toUrl: 'Next.js Router Recovery (Reload)',
                sessionExists: true, // 임시 표시
                stackTrace: stack
            });
        } catch (e) {
            console.error('Error in global error logger:', e);
        }
    };

    // 2. 잡히지 않은 비동기 Promise Rejection 감지
    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
        try {
            const reason = event.reason;
            const message = reason?.message || String(reason) || 'Promise Rejected';
            const stack = reason?.stack || '';
            
            recordBounceLog({
                source: 'Promise / Async Thrown',
                reason: `Unhandled Rejection: ${message}`,
                fromUrl: window.location.pathname + window.location.search,
                toUrl: 'Next.js Router Recovery (Reload)',
                sessionExists: true,
                stackTrace: stack
            });
        } catch (e) {
            console.error('Error in global promise rejection logger:', e);
        }
    };

    // 3. 무음 라우팅 이동 가로채기 (Navigation Interceptor)
    const originalPushState = history.pushState;
    const originalReplaceState = history.replaceState;
    const originalBack = history.back;

    history.pushState = function (data: any, unused: string, url?: string | URL | null) {
        try {
            const targetUrl = url ? String(url) : '';
            if (targetUrl === '/' || targetUrl.endsWith('/')) {
                const stack = new Error().stack || '';
                recordBounceLog({
                    source: 'Navigation Interceptor (pushState)',
                    reason: `pushState Silent Redirect to '/'`,
                    fromUrl: window.location.pathname + window.location.search,
                    toUrl: targetUrl,
                    sessionExists: true,
                    stackTrace: stack
                });
            }
        } catch (e) {
            console.error('Error in pushState interceptor:', e);
        }
        return originalPushState.apply(this, arguments as any);
    };

    history.replaceState = function (data: any, unused: string, url?: string | URL | null) {
        try {
            const targetUrl = url ? String(url) : '';
            if (targetUrl === '/' || targetUrl.endsWith('/')) {
                const stack = new Error().stack || '';
                recordBounceLog({
                    source: 'Navigation Interceptor (replaceState)',
                    reason: `replaceState Silent Redirect to '/'`,
                    fromUrl: window.location.pathname + window.location.search,
                    toUrl: targetUrl,
                    sessionExists: true,
                    stackTrace: stack
                });
            }
        } catch (e) {
            console.error('Error in replaceState interceptor:', e);
        }
        return originalReplaceState.apply(this, arguments as any);
    };

    history.back = function () {
        try {
            const stack = new Error().stack || '';
            recordBounceLog({
                source: 'Navigation Interceptor (history.back)',
                reason: `history.back() triggered`,
                fromUrl: window.location.pathname + window.location.search,
                toUrl: 'Previous History State',
                sessionExists: true,
                stackTrace: stack
            });
        } catch (e) {
            console.error('Error in back interceptor:', e);
        }
        return originalBack.apply(this, arguments as any);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
        window.removeEventListener('error', handleError);
        window.removeEventListener('unhandledrejection', handleUnhandledRejection);
        history.pushState = originalPushState;
        history.replaceState = originalReplaceState;
        history.back = originalBack;
    };
}
