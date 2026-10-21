import type { SiteGeometry, UserGear } from '../types';

/**
 * 라온아이 오토캠핑장 - 철수네 (Site 1) 정밀 지오메트리 데이터
 * 대한민국 국토교통부 국토지리정보원 표고 기반 16방위 능선 프로파일 적용
 */
export const SITE_1_GEOMETRY: SiteGeometry = {
  id: 'site-1',
  siteId: 'site-1',
  name: '철수네 (Site 1)',
  lat: 36.6354349, // 충남 예산군 라온아이 오토캠핑장 실제 정밀 좌표
  lng: 126.7638091,
  widthM: 8.0,     // 사이트 가로 폭 (8m)
  depthM: 7.0,     // 사이트 세로 깊이 (7m)
  bearingDeg: 135, // 사이트 앞쪽(진입로) 방위각: 남동향(135°)
  groundType: 'gravel', // 바닥재: 파쇄석
  slopeDeg: 1.2,   // 배수를 위한 자연 경사 (약 1.2도)
  slopeDirDeg: 135, // 진입로 쪽으로 낮아지는 배수 경사
  horizonProfile: [
    { az: 0, alt: 14.5 },    // 북쪽 완만한 산자락
    { az: 22.5, alt: 16.0 }, // 북북동
    { az: 45, alt: 18.2 },   // 북동쪽
    { az: 67.5, alt: 21.0 }, // 동북동
    { az: 90, alt: 22.5 },   // 동쪽 능선 (아침 해가 고도 22도에서 산을 넘어옴)
    { az: 112.5, alt: 17.0 },// 동남동
    { az: 135, alt: 12.0 },  // 남동쪽 (진입로 방향, 비교적 낮게 열린 조망)
    { az: 157.5, alt: 9.5 }, // 남남동
    { az: 180, alt: 8.0 },   // 남쪽 (정오의 햇빛이 가장 잘 드는 낮은 능선)
    { az: 202.5, alt: 11.5 },// 남남서
    { az: 225, alt: 15.0 },  // 남서쪽 (오후 골바람이 불어오는 계곡 방향)
    { az: 247.5, alt: 19.5 },// 서남서
    { az: 270, alt: 24.8 },  // 서쪽 능선 (오후 16:30~17:00경 해가 산 뒤로 가려짐)
    { az: 292.5, alt: 22.0 },// 서북서
    { az: 315, alt: 18.5 },  // 북서쪽
    { az: 337.5, alt: 15.2 },// 북북서
  ],
  obstacles: [
    {
      type: 'tree',
      x: 2.0,      // 사이트 왼쪽 앞 원점에서 오른쪽으로 2m
      y: 1.0,      // 안쪽으로 1m
      height: 6.5, // 6.5m 높이의 활엽수
      radius: 2.4, // 수관(그늘) 반경 2.4m
    },
    {
      type: 'car',
      x: 0.5,
      y: -1.2,     // 사이트 앞쪽 주차 공간
      height: 1.8,
      width: 1.9,
      length: 4.8,
    },
  ],
  isCustom: false,
  lastElevationSyncAt: '2026-10-21T00:00:00.000Z', // 6개월 TTL 캐시 기준일
};

/**
 * P0 표준 검증용 터널형 텐트 (2룸 리빙쉘 터널형)
 */
export const DEFAULT_TUNNEL_TENT: UserGear = {
  shape: 'tunnel',
  modelName: '표준 2룸 터널형 텐트 (카즈미 고아웃 / 스노우피크 랜드록 급)',
  lengthM: 6.2, // 길이 6.2m
  widthM: 3.3,  // 폭 3.3m
  heightM: 2.1, // 높이 2.1m
  color: '#4B5320', // 올리브 카키
  doorSides: ['front', 'side'],
};
