/**
 * 내비게이션 앱 연동을 위한 유틸리티
 * [v11.9.45] 카카오내비, T맵, 네이버 지도 딥링크 생성 및 리다이렉트 로직
 */

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
    const x = destination.lng.toFixed(6);
    const y = destination.lat.toFixed(6);
    const appKey = process.env.NEXT_PUBLIC_KAKAO_REST_API_KEY || '';
    
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    if (isAndroid) {
        return `intent://navigate?apiver=1.0&appkey=${appKey}&name=${name}&x=${x}&y=${y}&coord_type=wgs84#Intent;scheme=kakaonavi;package=com.locnall.KimGiSa;end`;
    }
    
    return `kakaonavi://navigate?apiver=1.0&appkey=${appKey}&name=${name}&x=${x}&y=${y}&coord_type=wgs84`;
}

/**
 * T맵 딥링크 생성 (tmap://route)
 * [v11.9.67] 안드로이드 전용 강력 규격(goalx, goaly) 적용
 */
export function getTMapUrl({ destination, waypoints }: FullRouteParams) {
    const isIOS = typeof navigator !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    const isAndroid = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
    
    const gLat = destination.lat.toFixed(6);
    const gLon = destination.lng.toFixed(6);

    let url = '';
    if (isIOS) {
        // iOS는 기존 rGoX/Y 규격 유지
        url = `tmap://route?rGoName=${encodeURIComponent('목적지')}&rGoX=${gLon}&rGoY=${gLat}&rRouteType=1`;
    } else {
        // 안드로이드는 가장 확실한 goalx/y 규격 사용
        url = `tmap://route?goalname=${encodeURIComponent('목적지')}&goalx=${gLon}&goaly=${gLat}`;
    }

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        const vLat = v.lat.toFixed(6);
        const vLon = v.lng.toFixed(6);
        if (isIOS) {
            url += `&rV1Name=${encodeURIComponent('경유지')}&rV1X=${vLon}&rV1Y=${vLat}`;
        } else {
            // 안드로이드 경유지 규격 (v1x, v1y)
            url += `&v1name=${encodeURIComponent('경유지')}&v1x=${vLon}&v1y=${vLat}`;
        }
    }

    // 안드로이드 크롬/TWA 환경일 경우 Intent URI 로 안전하게 래핑
    if (isAndroid) {
        return url.replace('tmap://', 'intent://') + '#Intent;scheme=tmap;package=com.skt.tmap.ku;end';
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
 * 웹 폴백 URL 생성
 */
export function getWebFallbackUrl(app: 'kakao' | 'tmap' | 'naver' | 'kakaonavi', { destination }: FullRouteParams) {
    const dName = encodeURIComponent(destination.name);
    return `https://map.kakao.com/link/to/${dName},${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;
}

/**
 * 앱 실행 시도 및 폴백 처리
 */
export function openNavApp(app: 'kakao' | 'tmap' | 'naver' | 'kakaonavi', route: FullRouteParams) {
    let url = '';
    switch (app) {
        case 'kakao': url = getKakaoMapUrl(route); break;
        case 'kakaonavi': url = getKakaoNaviUrl(route); break;
        case 'tmap': url = getTMapUrl(route); break;
        case 'naver': url = getNaverMapUrl(route); break;
    }

    const fallbackUrl = getWebFallbackUrl(app, route);

    // 딥링크 실행
    window.location.href = url;

    // 앱이 열리지 않았을 경우를 대비한 폴백 (2초 후)
    setTimeout(() => {
        if (document.visibilityState === 'visible') {
            window.open(fallbackUrl, '_blank');
        }
    }, 2000);

    return url;
}
