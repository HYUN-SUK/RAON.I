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
    // [v11.9.61] URLSearchParams의 %2C 인코딩 문제를 피하기 위해 직접 문자열 구성
    let url = `kakaomap://route?sp=${origin.lat},${origin.lng}&sName=${sName}&ep=${destination.lat},${destination.lng}&eName=${eName}&by=CAR`;

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        url += `&via1=${v.lat},${v.lng}&via1Name=${encodeURIComponent(v.name)}`;
    }

    return url;
}

/**
 * 카카오내비 딥링크 생성 (kakaonavi://navigate)
 * [v11.9.61] 카카오내비는 x, y(경도, 위도) 순서 주의
 */
export function getKakaoNaviUrl({ destination }: FullRouteParams) {
    const name = encodeURIComponent(destination.name);
    return `kakaonavi://navigate?name=${name}&x=${destination.lng}&y=${destination.lat}&coord_type=wgs84`;
}

/**
 * T맵 딥링크 생성 (tmap://route)
 */
export function getTMapUrl({ origin, destination, waypoints }: FullRouteParams) {
    const sName = encodeURIComponent(origin.name);
    const gName = encodeURIComponent(destination.name);
    let url = `tmap://route?rStName=${sName}&rStLat=${origin.lat}&rStLon=${origin.lng}&rGoName=${gName}&rGoLat=${destination.lat}&rGoLon=${destination.lng}`;

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        url += `&rV1Name=${encodeURIComponent(v.name)}&rV1Lat=${v.lat}&rV1Lon=${v.lng}`;
    }

    return url;
}

/**
 * 네이버 지도 딥링크 생성 (nmap://route/car)
 */
export function getNaverMapUrl({ origin, destination, waypoints }: FullRouteParams) {
    const baseUrl = 'nmap://route/car';
    const params = new URLSearchParams({
        slat: origin.lat.toString(),
        slng: origin.lng.toString(),
        sname: origin.name,
        dlat: destination.lat.toString(),
        dlng: destination.lng.toString(),
        dname: destination.name,
        appname: 'com.raonai.app'
    });

    if (waypoints && waypoints.length > 0) {
        const v = waypoints[0];
        params.append('v1lat', v.lat.toString());
        params.append('v1lng', v.lng.toString());
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
        return `https://map.kakao.com/link/from/${sName},${origin.lat},${origin.lng}/to/${dName},${destination.lat},${destination.lng}`;
    }
    return `https://map.naver.com/v5/directions/${origin.lng},${origin.lat},${sName}/${destination.lng},${destination.lat},${dName}/-/car`;
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

    return url; // [v11.9.61] 디버깅을 위해 URL 반환
}
