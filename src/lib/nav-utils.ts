import { logNavIntent, type NavIntentPayload } from './moat-logger';

export type { NavIntentPayload };

interface NavParams {
    name: string;
    lat: number;
    lng: number;
}


interface FullRouteParams {
    origin: NavParams;
    destination: NavParams;
    waypoints?: NavParams[];
}

/**
 * 카카오맵 딥링크 생성 (kakaomap://route)
 * [v11.9.65] 출발지 생략 (현재 위치 자동 인식)
 */
export function getKakaoMapUrl({ destination, waypoints }: FullRouteParams) {
    const eName = encodeURIComponent(destination.name);
    const eLat = destination.lat.toFixed(6);
    const eLng = destination.lng.toFixed(6);

    // sp(출발지) 생략
    let url = `kakaomap://route?ep=${eLat},${eLng}&eName=${eName}&by=CAR`;

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        url += `&via1=${v.lat.toFixed(6)},${v.lng.toFixed(6)}&via1Name=${encodeURIComponent(v.name)}`;
    }

    return url;
}

/**
 * 카카오내비 딥링크 생성 (kakaonavi://navigate)
 */
export function getKakaoNaviUrl({ destination }: FullRouteParams) {
    const name = encodeURIComponent(destination.name);
    const lat = destination.lat.toFixed(6);
    const lng = destination.lng.toFixed(6);
    
    // [v15.1.0] Capacitor 안드로이드 WebView(Bridge.java) 및 모바일 공통 순수 커스텀 스킴 적용
    return `kakaonavi://navigate?name=${name}&x=${lng}&y=${lat}&coord_type=wgs84`;
}

/**
 * T맵 딥링크 생성 (tmap://route)
 * [v11.9.67] 안드로이드 전용 강력 규격(goalx, goaly) 적용
 */
export function getTMapUrl({ destination, waypoints }: FullRouteParams) {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    
    const gName = encodeURIComponent(destination.name || '목적지');
    const gLat = destination.lat.toFixed(6);
    const gLon = destination.lng.toFixed(6);

    let url = '';
    if (isIOS) {
        // iOS는 기존 rGoX/Y 규격 유지
        url = `tmap://route?rGoName=${gName}&rGoX=${gLon}&rGoY=${gLat}&rRouteType=1`;
    } else {
        // 안드로이드는 가장 확실한 goalx/y 순수 스킴 사용 (Capacitor WebView 즉시 실행 호환)
        url = `tmap://route?goalname=${gName}&goalx=${gLon}&goaly=${gLat}`;
    }

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        const vName = encodeURIComponent(v.name || '경유지');
        const vLat = v.lat.toFixed(6);
        const vLon = v.lng.toFixed(6);
        if (isIOS) {
            url += `&rV1Name=${vName}&rV1X=${vLon}&rV1Y=${vLat}`;
        } else {
            // 안드로이드 경유지 규격 (v1x, v1y)
            url += `&v1name=${vName}&v1x=${vLon}&v1y=${vLat}`;
        }
    }

    return url;
}

/**
 * 네이버 지도 딥링크 생성 (nmap://route/car)
 * [v11.9.65] 출발지 생략
 */
export function getNaverMapUrl({ destination, waypoints }: FullRouteParams) {
    const baseUrl = 'nmap://route/car';
    const params = new URLSearchParams({
        dlat: destination.lat.toFixed(6),
        dlng: destination.lng.toFixed(6),
        dname: destination.name,
        appname: 'com.raonai.app'
    });

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        params.append('v1lat', v.lat.toFixed(6));
        params.append('v1lng', v.lng.toFixed(6));
        params.append('v1name', v.name);
    }

    return `${baseUrl}?${params.toString()}`;
}

/**
 * 웹/스토어 폴백 URL 생성 (미설치 시 앱별 분리로 타 내비 앱 오작동 원천 차단)
 */
export function getWebFallbackUrl(app: 'kakao' | 'tmap' | 'naver' | 'kakaonavi', { destination }: FullRouteParams) {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const dName = encodeURIComponent(destination.name);
    const dLat = destination.lat.toFixed(6);
    const dLng = destination.lng.toFixed(6);

    switch (app) {
        case 'kakaonavi':
            return isIOS
                ? 'https://apps.apple.com/kr/app/id417698849'
                : 'https://play.google.com/store/apps/details?id=com.locnall.KimGiSa';
        case 'tmap':
            return isIOS
                ? 'https://apps.apple.com/kr/app/id431589174'
                : 'https://play.google.com/store/apps/details?id=com.skt.tmap.ku';
        case 'naver':
            return `https://map.naver.com/p/search/${dName}`;
        case 'kakao':
        default:
            return `https://map.kakao.com/link/to/${dName},${dLat},${dLng}`;
    }
}

/**
 * 앱 실행 시도 및 폴백 처리
 * [v14.0.0] A+D 해자 데이터 수집: 길안내 실행 로그(nav_intent_log) 비동기 연동
 */
export function openNavApp(
    app: 'kakao' | 'tmap' | 'naver' | 'kakaonavi', 
    route: FullRouteParams,
    metadata?: Omit<NavIntentPayload, 'navApp'>
) {
    // 1. [A+D 해자 데이터] 길안내 실행 로그 비동기 기록 (Fire-and-Forget)
    if (metadata) {
        logNavIntent({
            ...metadata,
            navApp: app,
        });
    }

    let url = '';
    switch (app) {
        case 'kakao': url = getKakaoMapUrl(route); break;
        case 'kakaonavi': url = getKakaoNaviUrl(route); break;
        case 'tmap': url = getTMapUrl(route); break;
        case 'naver': url = getNaverMapUrl(route); break;
    }

    const fallbackUrl = getWebFallbackUrl(app, route);

    // [v14.6.0] 사용자가 안내 팝업을 먼저 편안하게 인지할 수 있도록 700ms 지연 후 내비 앱 전환
    setTimeout(() => {
        if (url.startsWith('http://') || url.startsWith('https://')) {
            window.open(url, '_blank', 'noopener,noreferrer');
        } else {
            let appLaunched = false;
            const markLaunched = () => {
                if (document.visibilityState === 'hidden' || !document.hasFocus()) {
                    appLaunched = true;
                }
            };
            const onBlur = () => {
                appLaunched = true;
            };
            document.addEventListener('visibilitychange', markLaunched);
            window.addEventListener('blur', onBlur);

            // 네이티브 앱 스킴(kakaomap://, kakaonavi://, tmap://, nmap://) 실행
            window.location.href = url;

            // 앱이 열리지 않았을 경우(미설치)를 대비한 웹/스토어 폴백 (2.5초 후)
            setTimeout(() => {
                document.removeEventListener('visibilitychange', markLaunched);
                window.removeEventListener('blur', onBlur);
                if (!appLaunched && document.visibilityState === 'visible' && document.hasFocus()) {
                    window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
                }
            }, 2500);
        }
    }, 700);

    return url;
}

