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
 * 카카오맵 딥링크 생성 (전체 경로 안내 최적화)
 */
export function getKakaoNaviUrl({ origin, destination, waypoints }: FullRouteParams) {
    // 카카오맵 길찾기 스키마 사용 (sp: 출발, ep: 도착, via: 경유)
    const baseUrl = 'kakaomap://route';
    const params = new URLSearchParams({
        sp: `${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}`,
        sName: origin.name,
        ep: `${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`,
        eName: destination.name,
        by: 'CAR'
    });

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        params.append('via1', `${v.lat.toFixed(6)},${v.lng.toFixed(6)}`);
        params.append('via1Name', v.name);
    }

    return `${baseUrl}?${params.toString()}`;
}

/**
 * T맵 딥링크 생성 (rGo/rSt/rV1 규격 완결)
 */
export function getTMapUrl({ origin, destination, waypoints }: FullRouteParams) {
    const baseUrl = 'tmap://route';
    const params = new URLSearchParams({
        rStName: origin.name,
        rStLat: origin.lat.toFixed(6),
        rStLon: origin.lng.toFixed(6),
        rGoName: destination.name,
        rGoLat: destination.lat.toFixed(6),
        rGoLon: destination.lng.toFixed(6)
    });

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        params.append('rV1Name', v.name);
        params.append('rV1Lat', v.lat.toFixed(6));
        params.append('rV1Lon', v.lng.toFixed(6));
    }

    return `${baseUrl}?${params.toString()}`;
}

/**
 * 네이버 지도 딥링크 생성 (slat/dlat/v1lat 규격 완결)
 */
export function getNaverMapUrl({ origin, destination, waypoints }: FullRouteParams) {
    const baseUrl = 'nmap://route/car';
    const params = new URLSearchParams({
        slat: origin.lat.toFixed(6),
        slng: origin.lng.toFixed(6),
        sname: origin.name,
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
 * 웹 폴백 URL 생성 (전체 경로용)
 */
export function getWebFallbackUrl(app: 'kakao' | 'tmap' | 'naver', { origin, destination }: FullRouteParams) {
    const sName = encodeURIComponent(origin.name);
    const dName = encodeURIComponent(destination.name);
    
    if (app === 'kakao') {
        return `https://map.kakao.com/link/from/${sName},${origin.lat},${origin.lng}/to/${dName},${destination.lat},${destination.lng}`;
    }
    // 네이버 및 T맵 폴백 (네이버 지도 길찾기 웹 페이지)
    return `https://map.naver.com/v5/directions/${origin.lng},${origin.lat},${sName}/${destination.lng},${destination.lat},${dName}/-/car`;
}

/**
 * 앱 실행 시도 및 폴백 처리
 */
export function openNavApp(app: 'kakao' | 'tmap' | 'naver', route: FullRouteParams) {
    let url = '';
    switch (app) {
        case 'kakao': url = getKakaoNaviUrl(route); break;
        case 'tmap': url = getTMapUrl(route); break;
        case 'naver': url = getNaverMapUrl(route); break;
    }

    const fallbackUrl = getWebFallbackUrl(app, route);

    // 딥링크 실행 시도
    window.location.href = url;

    // 잠시 후 브라우저가 아직 활성 상태라면 (앱이 안 열렸다면) 폴백 이동
    setTimeout(() => {
        if (document.visibilityState === 'visible') {
            window.open(fallbackUrl, '_blank');
        }
    }, 2000);
}
