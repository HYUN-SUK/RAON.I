/**
 * weatherLightingEngine.ts
 * SunCalc 천문 물리 연산(실시간 태양 고도각·방위각, 일출·일몰) 및
 * 16방위 산 능선 차폐, 기상청 12대 전수 날씨 매트릭스를 결합한 순수 3D 조명/효과 연산 엔진
 */

import * as SunCalc from 'suncalc';
import { getSunVector, getInterpolatedRidgeAltitude } from '../utils/vectorMath';
import type {
  HorizonProfilePoint,
  WeatherCaseCode,
  WeatherLightingParams,
  PrecipitationType,
} from '../types';

/**
 * 특정 일자의 일출(Sunrise), 일몰(Sunset), 박명(Twilight) 시간 산출 (SunCalc)
 */
export function getSunTimesForDate(
  date: Date = new Date(),
  lat: number = 36.6354349, // 철수네 기본 위도
  lng: number = 126.7638091 // 철수네 기본 경도
) {
  const times = SunCalc.getTimes(date, lat, lng);
  const formatTime = (d?: Date | null) => {
    if (!d || isNaN(d.getTime())) return '--:--';
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  };

  return {
    sunriseStr: formatTime(times.sunrise),
    sunsetStr: formatTime(times.sunset),
    dawnStr: formatTime(times.dawn),
    duskStr: formatTime(times.dusk),
    goldenHourStr: formatTime(times.goldenHour),
    rawTimes: times,
  };
}

/**
 * 특정 일시의 실제 천문 고도각(altDeg) 및 나침반 방위각(azDeg) 연산 (SunCalc)
 */
export function calculateAstronomicalSunTrajectory({
  date = new Date(),
  hour,
  dayIndex = 1,
  lat = 36.6354349,
  lng = 126.7638091,
}: {
  date?: Date;
  hour: number;
  dayIndex?: number;
  lat?: number;
  lng?: number;
}): { azDeg: number; altDeg: number } {
  const targetDate = new Date(date);
  if (dayIndex > 1) {
    targetDate.setDate(targetDate.getDate() + (dayIndex - 1));
  }

  // hour 안전 정규화 (0.0 ~ 23.999)
  const safeHour = Math.max(0, Math.min(23.999, isNaN(hour) ? 12 : hour));
  const targetHour = Math.floor(safeHour);
  const targetMin = Math.floor((safeHour - targetHour) * 60);
  const targetSec = Math.floor(((safeHour - targetHour) * 60 - targetMin) * 60);

  targetDate.setHours(targetHour, targetMin, targetSec, 0);

  const sunPos = SunCalc.getPosition(targetDate, lat, lng);

  // 고도각(Altitude): 라디안 -> 도 (0 = 지평선, 90 = 천정, 음수 = 지평선 아래)
  const rawAltDeg = sunPos.altitude * (180 / Math.PI);
  // 비정상 수치(NaN, 무한대, 오차) 방지 안전 클램핑 (-90° ~ 90°)
  const altDeg = isNaN(rawAltDeg) ? 0 : Math.max(-90, Math.min(90, rawAltDeg));

  // 방위각(Azimuth): SunCalc(남쪽 0 기준) -> 나침반 표준(북=0, 동=90, 남=180, 서=270)
  let rawAzDeg = (sunPos.azimuth * (180 / Math.PI) + 180) % 360;
  if (rawAzDeg < 0) rawAzDeg += 360;
  const azDeg = isNaN(rawAzDeg) ? 180 : rawAzDeg;

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
 * 천문 고도각, 16방위 지형 능선 차폐, 기상청 12대 날씨 매트릭스를 종합한 3D 조명/효과 연산
 */
export function calculateWeatherLighting({
  hour,
  dayIndex = 1,
  date = new Date(),
  lat = 36.6354349,
  lng = 126.7638091,
  weatherCase = 'clear',
  windSpeed = 2.5,
  horizonProfile = [],
}: {
  hour: number;
  dayIndex?: number;
  date?: Date;
  lat?: number;
  lng?: number;
  weatherCase?: WeatherCaseCode;
  windSpeed?: number;
  horizonProfile?: HorizonProfilePoint[];
}): WeatherLightingParams {
  // 1. 해당 날짜 및 시각의 실제 천문 고도각 및 방위각 연산
  const { azDeg, altDeg } = calculateAstronomicalSunTrajectory({ date, hour, dayIndex, lat, lng });
  const sunTimes = getSunTimesForDate(date, lat, lng);

  // 2. 16방위 산 능선 고도각 및 차폐(산그늘) 여부 판정
  const ridgeAltDeg = getInterpolatedRidgeAltitude(horizonProfile, azDeg);
  const isDaylight = altDeg > 0;
  // 주간이더라도 해당 방위의 능선 고도각보다 낮으면 서쪽 산그늘 진입!
  const isOccludedByRidge = isDaylight && altDeg <= ridgeAltDeg;

  // 3. 천문 고도각(altDeg) 기반 시간대 상태 물리 판정
  const isGoldenHour = altDeg > 0 && altDeg <= 12;      // 일출/일몰 직전후 붉고 낮은 태양 (장축 그림자)
  const isCivilTwilight = altDeg <= 0 && altDeg > -6;   // 해 진 직후 황혼/블루아워 (붉은 잔광 + 인디고 블루)
  const isNight = altDeg <= -6;                         // 시민박명 종료 후 완전한 야간 (달빛 + 텐트 랜턴)

  // 4. 야간 감성 모닥불(불멍) 활성화 판정: 해가 진 후 황혼 또는 밤 (altDeg <= -2)
  const isBonfireActive = altDeg <= -2;
  const bonfireIntensity = isBonfireActive ? 2.0 + Math.sin(hour * 15) * 0.35 : 0;

  // 태양 광선 3D 위치 (광원 거리 28m)
  const [vx, vy, vz] = getSunVector(azDeg, Math.max(altDeg, 2));
  const lightDist = 28;
  const sunPos: [number, number, number] = [
    vx * lightDist,
    Math.max(1.5, vy * lightDist),
    vz * lightDist,
  ];

  // 기본 렌더링 템플릿
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
  let skyBgColor = '#87CEEB';
  let precipitationType: PrecipitationType = 'none';
  let precipitationSpeed = 1.0;
  let isLightning = false;
  let warningMessage: string | undefined;

  // 4. 천문 고도각에 따른 조명 물리 감쇄 및 색온도 변화
  if (isNight) {
    // 완전한 밤 (달빛 앰비언트)
    sunColor = '#81D4FA';
    sunIntensity = 0.03;
    ambientColor = '#101726';
    ambientIntensity = 0.18;
    hemiSkyColor = '#1C283F';
    hemiGroundColor = '#0B0F14';
    hemiIntensity = 0.22;
    shadowOpacity = 0.05;
    skyBgColor = '#0B0F19';
    fogColor = '#0F172A';
    fogDensity = 0.006;
  } else if (isCivilTwilight) {
    // 황혼 / 블루아워 (태양은 졌으나 하늘은 푸르스름하고 노을 잔광이 남음)
    sunColor = '#FF5722';
    sunIntensity = 0.15;
    ambientColor = '#3F51B5';
    ambientIntensity = 0.32;
    hemiSkyColor = '#5C6BC0';
    hemiGroundColor = '#1A237E';
    hemiIntensity = 0.35;
    shadowOpacity = 0.15;
    skyBgColor = '#1A237E';
    fogColor = '#283593';
    fogDensity = 0.005;
  } else if (isGoldenHour) {
    // 골든아워 (낮은 고도각 0~12°: 따뜻한 앰버/코랄 레드 노을)
    sunColor = azDeg < 180 ? '#FF8A50' : '#FF7043'; // 아침 일출 vs 저녁 일몰 톤
    sunIntensity = isOccludedByRidge ? 0.35 : 1.45;
    ambientColor = '#FFCCBC';
    ambientIntensity = 0.45;
    skyBgColor = '#FBE9E7';
    shadowOpacity = isOccludedByRidge ? 0.25 : 0.8;
  } else {
    // 한낮 주간 (고도각 12° 초과)
    // 고도각이 높을수록 맑고 쨍한 백색광 (정오 피크)
    sunIntensity = Math.min(2.0, 1.4 + (altDeg / 65) * 0.6);
    sunColor = altDeg > 45 ? '#FFFDF5' : '#FFF9E6';
  }

  // 산 능선 차폐(산그늘) 시 직사광 부드러운 감쇄
  if (isOccludedByRidge) {
    sunIntensity *= 0.22;
    shadowOpacity *= 0.3;
    ambientIntensity = Math.min(ambientIntensity * 1.25, 0.7);
  }

  // 5. 12대 전수 날씨 케이스(Matrix) 오버라이드
  switch (weatherCase) {
    case 'clear':
      if (altDeg > 40) {
        warningMessage = '한낮 직사광 노출 주의 (타프 그늘 권장)';
      }
      break;

    case 'partly_cloudy':
      if (isDaylight) {
        sunIntensity *= 0.75;
        ambientIntensity *= 1.2;
        shadowOpacity *= 0.7;
        skyBgColor = '#A0C4E2';
      }
      break;

    case 'overcast':
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
      sunIntensity = 0.0;
      ambientColor = '#263238';
      ambientIntensity = 0.32;
      shadowOpacity = 0.0;
      fogColor = '#37474F';
      fogDensity = 0.038;
      skyBgColor = '#1A232E';
      precipitationType = 'heavy_rain';
      precipitationSpeed = 2.2;
      isLightning = Math.random() > 0.65;
      if (isLightning) {
        sunIntensity = 4.5;
        sunColor = '#E1F5FE';
        ambientIntensity = 1.2;
      }
      warningMessage = '⚠️ 뇌우/낙뢰 경보: 금속 폴대/팩 접촉 엄금, 안전한 실내로 대피 권고';
      break;
  }

  // 6. 풍속 등급 연산 및 경고 합성
  const windInfo = getWindLevel(windSpeed);
  if (windInfo.warning) {
    warningMessage = warningMessage
      ? `${warningMessage} | ${windInfo.warning}`
      : windInfo.warning;
  }

  // 7. 야간 텐트 감성 랜턴 점등 (천문 고도각 altDeg <= -6° 기준!)
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
    isBonfireActive,
    bonfireIntensity,
    precipitationType,
    precipitationSpeed,
    windLevel: windInfo.level,
    windSpeed,
    isLightning,
    isOccludedByRidge,
    altitudeDeg: Math.round(altDeg * 10) / 10,
    azimuthDeg: Math.round(azDeg),
    sunriseStr: sunTimes.sunriseStr,
    sunsetStr: sunTimes.sunsetStr,
    warningMessage,
  };
}
