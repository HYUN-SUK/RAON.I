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
 */
export function getKakaoMapUrl({ origin, destination, waypoints }: FullRouteParams) {
    const sName = encodeURIComponent(origin.name);
    const eName = encodeURIComponent(destination.name);
    // [v11.9.61] 소수점 6자리 고정 및 URL 구성
    const sLat = origin.lat.toFixed(6);
    const sLng = origin.lng.toFixed(6);
    const eLat = destination.lat.toFixed(6);
    const eLng = destination.lng.toFixed(6);

    let url = `kakaomap://route?sp=${sLat},${sLng}&sName=${sName}&ep=${eLat},${eLng}&eName=${eName}&by=CAR`;

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        url += `&via1=${v.lat.toFixed(6)},${v.lng.toFixed(6)}&via1Name=${encodeURIComponent(v.name)}`;
    }

    return url;
}

/**
 * 카카오내비 딥링크 생성 (kakaonavi://navigate)
 * [v11.9.61] 카카오내비는 x, y(경도, 위도) 순서 및 소수점 제한
 */
export function getKakaoNaviUrl({ destination }: FullRouteParams) {
    const name = encodeURIComponent(destination.name);
    const x = destination.lng.toFixed(6);
    const y = destination.lat.toFixed(6);
    return `kakaonavi://navigate?name=${name}&x=${x}&y=${y}&coord_type=wgs84`;
}

/**
 * T맵 딥링크 생성 (tmap://route)
 * [v11.9.64] 통합 규격(X,Y) 및 경로 탐색 옵션 적용
 */
export function getTMapUrl({ origin, destination, waypoints }: FullRouteParams) {
    const sName = encodeURIComponent('출발지');
    const gName = encodeURIComponent('도착지');
    
    // [v11.9.64] 최신 규격은 OS 상관없이 X(경도), Y(위도) 사용
    const sLat = origin.lat.toFixed(6);
    const sLon = origin.lng.toFixed(6);
    const gLat = destination.lat.toFixed(6);
    const gLon = destination.lng.toFixed(6);

    // rRouteType=1: 추천 경로
    let url = `tmap://route?rStName=${sName}&rStX=${sLon}&rStY=${sLat}&rGoName=${gName}&rGoX=${gLon}&rGoY=${gLat}&rRouteType=1`;

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        const vLat = v.lat.toFixed(6);
        const vLon = v.lng.toFixed(6);
        url += `&rV1Name=${encodeURIComponent('경유지')}&rV1X=${vLon}&rV1Y=${vLat}`;
    }

    return url;
}

/**
 * 네이버 지도 딥링크 생성 (nmap://route/car)
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
 * 웹 폴백 URL 생성
 */
export function getWebFallbackUrl(app: 'kakao' | 'tmap' | 'naver' | 'kakaonavi', { origin, destination }: FullRouteParams) {
    const sName = encodeURIComponent(origin.name);
    const dName = encodeURIComponent(destination.name);
    
    if (app === 'kakao' || app === 'kakaonavi') {
        return `https://map.kakao.com/link/from/${sName},${origin.lat.toFixed(6)},${origin.lng.toFixed(6)}/to/${dName},${destination.lat.toFixed(6)},${destination.lng.toFixed(6)}`;
    }
    return `https://map.naver.com/v5/directions/${origin.lng.toFixed(6)},${origin.lat.toFixed(6)},${sName}/${destination.lng.toFixed(6)},${destination.lat.toFixed(6)},${dName}/-/car`;
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
