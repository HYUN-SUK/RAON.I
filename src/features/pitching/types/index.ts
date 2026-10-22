export type TentShape = 'tunnel' | 'dome' | 'livingshell' | 'tipi';

export type GroundType = 'gravel' | 'deck' | 'grass' | 'soil';

export interface HorizonProfilePoint {
  az: number;   // 방위각 (0 ~ 360°, 0=북, 90=동)
  alt: number;  // 능선 고도각 (도 단위)
}

export interface SiteObstacle {
  type: 'tree' | 'car' | 'deck' | 'post';
  x: number;       // 사이트 원점 기준 x(오른쪽) 거리 (m)
  y: number;       // 사이트 원점 기준 y(안쪽) 거리 (m)
  height: number;  // 높이 (m)
  radius?: number; // 수관 또는 장애물 반경 (m)
  width?: number;
  length?: number;
}

export interface SiteGeometry {
  id: string;
  siteId?: string;
  name: string;
  lat: number;
  lng: number;
  widthM: number;
  depthM: number;
  bearingDeg: number; // 진입로/앞쪽 방위각 (0=북, 90=동)
  groundType: GroundType;
  slopeDeg?: number;
  slopeDirDeg?: number;
  horizonProfile: HorizonProfilePoint[];
  obstacles: SiteObstacle[];
  isCustom?: boolean;
  lastElevationSyncAt?: string; // 국토지리정보원/브이월드 지형 데이터 최종 동기화 시각 (6개월 주기 갱신용)
}

export interface UserGear {
  id?: string;
  userId?: string;
  shape: TentShape;
  modelName?: string;
  lengthM: number;
  widthM: number;
  heightM: number;
  color: string;
  doorSides: ('front' | 'side' | 'back')[];
}

export interface SunPosition {
  azimuthDeg: number;  // 0~360° (북=0, 동=90, 남=180, 서=270)
  altitudeDeg: number; // 0~90° (수평선=0, 천정=90)
  isOccludedByRidge: boolean; // 산 능선에 가려졌는지 여부
}

export interface WeatherTimelinePoint {
  timeStr: string;     // 예: "15:00"
  timestamp: number;
  temp: number;        // 기온 (°C)
  sky: number;         // 1: 맑음, 3: 구름많음, 4: 흐림
  pty: number;         // 0: 없음, 1: 비, 2: 비/눈, 3: 눈, 4: 소나기
  pop: number;         // 강수확률 (%)
  wsd: number;         // 풍속 (m/s)
  vec: number;         // 풍향 (0~360°)
  sun: SunPosition;
}

export interface PitchSimulationResult {
  recommendedBearingDeg: number;
  score: number;
  reinforcedPegs: { position: [number, number, number]; reason: string }[];
  warningTimeRanges: { timeStr: string; message: string; severity: 'low' | 'medium' | 'high' }[];
  checklist: string[];
}

export type WeatherCaseCode =
  | 'clear'         // 쾌청 맑음
  | 'partly_cloudy' // 구름많음
  | 'overcast'      // 흐림
  | 'drizzle'       // 약한 비 / 이슬비
  | 'rain'          // 보통 비
  | 'heavy_rain'    // 폭우 / 호우
  | 'shower'        // 소나기
  | 'sleet'         // 진눈깨비
  | 'snow'          // 눈 / 함박눈
  | 'fog'           // 안개 / 짙은 안개
  | 'yellow_dust'   // 황사 / 미세먼지
  | 'thunderstorm'; // 뇌우 / 천둥번개

export type StayDuration = '1N2D' | '2N3D' | '3N4D';

export type PrecipitationType = 'none' | 'rain' | 'heavy_rain' | 'snow' | 'sleet';

export interface WeatherLightingParams {
  timeStr: string;
  hour: number;
  dayIndex: number;
  sunPos: [number, number, number];
  sunColor: string;
  sunIntensity: number;
  ambientColor: string;
  ambientIntensity: number;
  hemiSkyColor: string;
  hemiGroundColor: string;
  hemiIntensity: number;
  shadowOpacity: number;
  fogColor: string;
  fogDensity: number;
  skyBgColor: string;
  isTentLanternOn: boolean;
  precipitationType: PrecipitationType;
  precipitationSpeed: number;
  windLevel: number;
  windSpeed: number;
  isLightning: boolean;
  isOccludedByRidge: boolean;
  warningMessage?: string;
}
