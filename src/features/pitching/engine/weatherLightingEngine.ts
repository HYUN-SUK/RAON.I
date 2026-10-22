/**
 * weatherLightingEngine.ts
 * 기상청 전수 예보(SKY, PTY, 특수 기상) 및 24시간 태양 궤적, 16방위 산 능선 차폐를 결합한
 * 순수 3D 조명 및 시각 효과 매트릭스(Matrix) 연산 엔진
 */

import { getSunVector, getInterpolatedRidgeAltitude } from '../utils/vectorMath';
import type {
  HorizonProfilePoint,
  WeatherCaseCode,
  WeatherLightingParams,
  PrecipitationType,
} from '../types';

/**
 * 24시간 태양 고도각(altDeg) 및 방위각(azDeg) 근사 모델 (한국 춘추 예산군 기준)
 */
export function calculateSunTrajectory(hour: number): { azDeg: number; altDeg: number } {
  // hour: 0.0 ~ 24.0
  // 일출 약 06:00 (동쪽 85°), 정오 12:30 (남쪽 180°, 최고 고도 62°), 일몰 약 18:45 (서쪽 275°)
  let azDeg = 180;
  let altDeg = -30; // 기본 밤

  if (hour >= 5.5 && hour <= 19.5) {
    // 주간 및 박명 시간대
    const progress = (hour - 5.5) / (19.5 - 5.5); // 0.0 ~ 1.0
    azDeg = 80 + progress * 200; // 80°(동) ~ 280°(서)
    // 정오 12.5시 기준 사인 곡선 피크 고도 62°
    const sinFactor = Math.sin(progress * Math.PI);
    altDeg = sinFactor * 62;
  } else {
    // 야간 시간대
    if (hour > 19.5) {
      const nightProgress = (hour - 19.5) / 10.0;
      azDeg = 280 + nightProgress * 80;
      altDeg = -Math.sin(nightProgress * Math.PI) * 45;
    } else {
      const nightProgress = (hour + 4.5) / 10.0;
      azDeg = 360 - nightProgress * 80;
      altDeg = -Math.sin(nightProgress * Math.PI) * 45;
    }
  }

  return { azDeg, altDeg };
}

/**
 * 풍속(m/s)에 따른 5단계 풍속 등급 산출
 */
export function getWindLevel(windSpeed: number): { level: number; label: string; warning?: string } {
  if (windSpeed < 3.5) {
    return { level: 1, label: '미풍 (0~3 m/s)' };
  } else if (windSpeed < 7.0) {
    return { level: 2, label: '보통바람 (4~6 m/s)' };
  } else if (windSpeed < 10.0) {
    return {
      level: 3,
      label: '약간 강한 바람 (7~9 m/s)',
      warning: '풍상측 40cm 장팩 및 가이라인 텐션 필수',
    };
  } else if (windSpeed < 14.0) {
    return {
      level: 4,
      label: '강풍 (10~13 m/s)',
      warning: '폴대 휨 방지 윈드 크로스 스트링 보강 필수',
    };
  } else {
    return {
      level: 5,
      label: '돌풍/태풍 (14 m/s 이상)',
      warning: '⚠️ 피칭 위험 등급! 텐트 파손 우려 사이트 철수 권고',
    };
  }
}

/**
 * 날씨 케이스 및 시각, 풍속, 지형 능선을 종합하여 3D 조명/안개/파티클 파라미터 반환
 */
export function calculateWeatherLighting({
  hour,
  dayIndex = 1,
  weatherCase = 'clear',
  windSpeed = 2.5,
  horizonProfile = [],
}: {
  hour: number;
  dayIndex?: number;
  weatherCase?: WeatherCaseCode;
  windSpeed?: number;
  horizonProfile?: HorizonProfilePoint[];
}): WeatherLightingParams {
  const { azDeg, altDeg } = calculateSunTrajectory(hour);
  const ridgeAltDeg = getInterpolatedRidgeAltitude(horizonProfile, azDeg);
  const isOccludedByRidge = altDeg <= ridgeAltDeg && altDeg > 0;
  const isDaylight = altDeg > 0;
  const isNight = hour < 5.5 || hour >= 19.5;
  const isSunsetHour = hour >= 16.5 && hour < 19.0;
  const isSunriseHour = hour >= 5.5 && hour < 7.5;

  // 태양 광선 3D 위치 (광원 거리 28m)
  const [vx, vy, vz] = getSunVector(azDeg, Math.max(altDeg, 2));
  const lightDist = 28;
  const sunPos: [number, number, number] = [
    vx * lightDist,
    Math.max(1.5, vy * lightDist),
    vz * lightDist,
  ];

  // 12대 날씨 케이스별 기본 렌더링 파라미터 템플릿
  let sunColor = '#FFFDF5';
  let sunIntensity = 1.85;
  let ambientColor = '#E3F2FD';
  let ambientIntensity = 0.42;
  let hemiSkyColor = '#C7E8D6';
  let hemiGroundColor = '#2A3C2E';
  let hemiIntensity = 0.45;
  let shadowOpacity = 0.85;
  let fogColor = '#E8F5E9';
  let fogDensity = 0.001;
  let skyBgColor = '#87CEEB'; // 기본 하늘색
  let precipitationType: PrecipitationType = 'none';
  let precipitationSpeed = 1.0;
  let isLightning = false;
  let warningMessage: string | undefined;

  // 1. 시간대별 태양 색상 및 기본 조도 변조
  if (isNight) {
    // 칠흑 같은 밤하늘 (달빛 앰비언트)
    sunColor = '#81D4FA';
    sunIntensity = 0.05;
    ambientColor = '#101726';
    ambientIntensity = 0.18;
    hemiSkyColor = '#1C283F';
    hemiGroundColor = '#0B0F14';
    hemiIntensity = 0.22;
    shadowOpacity = 0.05;
    skyBgColor = '#0B0F19';
    fogColor = '#0F172A';
    fogDensity = 0.006;
  } else if (isSunriseHour) {
    // 아침 일출 골든아워
    sunColor = '#FF8A50';
    sunIntensity = 1.3;
    ambientColor = '#FFE0B2';
    ambientIntensity = 0.38;
    skyBgColor = '#FDEBD0';
  } else if (isSunsetHour) {
    // 저녁 일몰 골든아워 (노을)
    sunColor = '#FF7043';
    sunIntensity = isOccludedByRidge ? 0.35 : 1.45;
    ambientColor = '#FFCCBC';
    ambientIntensity = 0.45;
    skyBgColor = '#FBE9E7';
  }

  // 산 능선 차폐(산그늘) 시 직사광 감쇄
  if (isOccludedByRidge && isDaylight) {
    sunIntensity *= 0.22;
    shadowOpacity *= 0.3;
    ambientIntensity = Math.min(ambientIntensity * 1.25, 0.7);
  }

  // 2. 12대 전수 날씨 케이스(Matrix) 오버라이드
  switch (weatherCase) {
    case 'clear':
      // 쾌청 맑음: 기본 템플릿 유지
      if (!isNight) {
        warningMessage = hour >= 11 && hour <= 15 ? '한낮 직사광 노출 주의 (타프 그늘 권장)' : undefined;
      }
      break;

    case 'partly_cloudy':
      // 구름많음: 부드러운 산란광
      if (!isNight) {
        sunIntensity *= 0.75;
        ambientIntensity *= 1.2;
        shadowOpacity = 0.55;
        skyBgColor = '#A0C4E2';
      }
      break;

    case 'overcast':
      // 흐림: 직사광 소멸, 쿨그레이 전천후 잿빛
      sunIntensity = 0.15;
      sunColor = '#B0BEC5';
      ambientColor = '#90A4AE';
      ambientIntensity = isNight ? 0.15 : 0.72;
      hemiSkyColor = '#78909C';
      hemiGroundColor = '#37474F';
      shadowOpacity = 0.12;
      fogColor = '#CFD8DC';
      fogDensity = 0.012;
      skyBgColor = isNight ? '#111827' : '#9E9E9E';
      warningMessage = '흐린 날씨: 자외선 낮음, 쌀쌀한 기온 대비';
      break;

    case 'drizzle':
      // 약한 비 / 이슬비
      sunIntensity = 0.1;
      sunColor = '#90A4AE';
      ambientColor = '#78909C';
      ambientIntensity = 0.65;
      shadowOpacity = 0.08;
      fogColor = '#B0BEC5';
      fogDensity = 0.016;
      skyBgColor = isNight ? '#0F172A' : '#78909C';
      precipitationType = 'rain';
      precipitationSpeed = 0.7;
      warningMessage = '이슬비: 우중 감성 모드, 텐트 결로 환기 권장';
      break;

    case 'rain':
      // 보통 비
      sunIntensity = 0.04;
      ambientColor = '#607D8B';
      ambientIntensity = isNight ? 0.12 : 0.58;
      shadowOpacity = 0.0;
      fogColor = '#90A4AE';
      fogDensity = 0.022;
      skyBgColor = isNight ? '#0B0F19' : '#607D8B';
      precipitationType = 'rain';
      precipitationSpeed = 1.2;
      warningMessage = '우천: 플라이 고정 및 텐트 주변 배수로 점검 권고';
      break;

    case 'heavy_rain':
      // 폭우 / 호우
      sunIntensity = 0.0;
      ambientColor = '#455A64';
      ambientIntensity = 0.42;
      shadowOpacity = 0.0;
      fogColor = '#546E7A';
      fogDensity = 0.035;
      skyBgColor = '#37474F';
      precipitationType = 'heavy_rain';
      precipitationSpeed = 2.0;
      warningMessage = '⚠️ 호우 경보: 침수 위험 지역 확인 및 배수로 즉시 확보';
      break;

    case 'shower':
      // 소나기: 구름 틈새 빛줄기 연출
      sunIntensity = 0.65;
      sunColor = '#FFF9C4';
      ambientIntensity = 0.6;
      shadowOpacity = 0.35;
      fogColor = '#B0BEC5';
      fogDensity = 0.018;
      skyBgColor = '#607D8B';
      precipitationType = 'rain';
      precipitationSpeed = 1.5;
      warningMessage = '돌발 소나기: 야외 장비 실내 이동 권장';
      break;

    case 'sleet':
      // 진눈깨비
      sunIntensity = 0.08;
      sunColor = '#ECEFF1';
      ambientColor = '#B0BEC5';
      ambientIntensity = 0.62;
      shadowOpacity = 0.05;
      fogColor = '#CFD8DC';
      fogDensity = 0.024;
      skyBgColor = isNight ? '#0F172A' : '#78909C';
      precipitationType = 'sleet';
      precipitationSpeed = 0.9;
      warningMessage = '진눈깨비: 바닥 슬러시 빙판 형성 주의';
      break;

    case 'snow':
      // 눈 / 함박눈: 설원 반사광 웜화이트
      sunIntensity = 0.35;
      sunColor = '#FFFFFF';
      ambientColor = '#F5F5F5';
      ambientIntensity = isNight ? 0.28 : 0.85;
      hemiSkyColor = '#ECEFF1';
      hemiGroundColor = '#CFD8DC';
      shadowOpacity = 0.2;
      fogColor = '#ECEFF1';
      fogDensity = 0.026;
      skyBgColor = isNight ? '#1E293B' : '#E0E0E0';
      precipitationType = 'snow';
      precipitationSpeed = 0.5;
      warningMessage = '⚠️ 적설 주의: 텐트 지붕 눈 쌓임(스노우 로드) 털어내기 필수';
      break;

    case 'fog':
      // 안개 / 짙은 안개 (새벽/계곡)
      sunIntensity = isDaylight ? 0.2 : 0.02;
      sunColor = '#FFE0B2';
      ambientColor = '#CFD8DC';
      ambientIntensity = 0.72;
      shadowOpacity = 0.02;
      fogColor = '#ECEFF1';
      fogDensity = 0.045; // 최대 안개 밀도
      skyBgColor = isNight ? '#1E293B' : '#CFD8DC';
      warningMessage = '짙은 안개: 아침 결로 건조 필요, 시야 확보 주의';
      break;

    case 'yellow_dust':
      // 황사 / 고농도 미세먼지: 탁한 황갈색
      sunIntensity = 0.45;
      sunColor = '#D4A373';
      ambientColor = '#A1887F';
      ambientIntensity = 0.52;
      shadowOpacity = 0.3;
      fogColor = '#D7CCC8';
      fogDensity = 0.028;
      skyBgColor = '#BCAAA4';
      warningMessage = '⚠️ 황사/미세먼지 경보: 텐트 환기 금지 및 마스크 착용';
      break;

    case 'thunderstorm':
      // 뇌우 / 천둥번개: 먹구름 속 간헐적 섬광
      sunIntensity = 0.0;
      ambientColor = '#263238';
      ambientIntensity = 0.32;
      shadowOpacity = 0.0;
      fogColor = '#37474F';
      fogDensity = 0.038;
      skyBgColor = '#1A232E';
      precipitationType = 'heavy_rain';
      precipitationSpeed = 2.2;
      isLightning = Math.random() > 0.65; // 간헐적 번개 섬광
      if (isLightning) {
        sunIntensity = 4.5;
        sunColor = '#E1F5FE';
        ambientIntensity = 1.2;
      }
      warningMessage = '⚠️ 뇌우/낙뢰 경보: 금속 폴대/팩 접촉 엄금, 안전한 실내로 대피 권고';
      break;
  }

  // 3. 풍속 등급 연산 및 경고 합성
  const windInfo = getWindLevel(windSpeed);
  if (windInfo.warning) {
    warningMessage = warningMessage
      ? `${warningMessage} | ${windInfo.warning}`
      : windInfo.warning;
  }

  // 4. 야간 텐트 감성 랜턴 점등 (19:30 ~ 05:30)
  const isTentLanternOn = isNight;

  const formattedHour = Math.floor(hour);
  const formattedMin = Math.floor((hour - formattedHour) * 60);
  const timeStr = `${String(formattedHour).padStart(2, '0')}:${String(formattedMin).padStart(2, '0')}`;

  return {
    timeStr,
    hour,
    dayIndex,
    sunPos,
    sunColor,
    sunIntensity,
    ambientColor,
    ambientIntensity,
    hemiSkyColor,
    hemiGroundColor,
    hemiIntensity,
    shadowOpacity,
    fogColor,
    fogDensity,
    skyBgColor,
    isTentLanternOn,
    precipitationType,
    precipitationSpeed,
    windLevel: windInfo.level,
    windSpeed,
    isLightning,
    isOccludedByRidge,
    warningMessage,
  };
}
