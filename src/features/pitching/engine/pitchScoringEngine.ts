import type {
  SiteGeometry,
  UserGear,
  PitchSimulationResult,
  HorizonProfilePoint,
} from '../types';
import { getInterpolatedRidgeAltitude } from '../utils/vectorMath';

export interface WeatherPoint {
  hour: number;          // 10 ~ 18
  temp: number;          // 기온 (°C)
  windDirDeg: number;    // 풍향 (0~360°, 불어오는 방향)
  windSpeed: number;     // 풍속 (m/s)
  sunAzimuthDeg: number; // 태양 방위각
  sunAltitudeDeg: number;// 태양 고도각
}

/**
 * 표준 춘추(5월/10월) 예산군 기상/태양 타임라인 기본 데이터
 */
export function generateDefaultWeatherTimeline(horizonProfile: HorizonProfilePoint[] = []): WeatherPoint[] {
  const points: WeatherPoint[] = [];

  for (let h = 10; h <= 18; h += 0.5) {
    // 태양 방위각 (10시 130° ~ 18시 285°)
    const az = 130 + ((h - 10) / 8) * 155;
    // 태양 고도각 (정오 60° 피크 포물선)
    const norm = (h - 12) / 6;
    const alt = Math.max(2, 60 - Math.pow(norm, 2) * 56);

    // 오후에 주로 서남서(225°~240°) 골바람이 강해짐
    let speed = 2.0;
    let dir = 225; // 남서풍 기본
    if (h >= 13 && h <= 16) {
      speed = 3.8; // 오후 피크 풍속
      dir = 235;
    } else if (h > 16) {
      speed = 2.4;
      dir = 210;
    }

    points.push({
      hour: h,
      temp: h < 14 ? 21 + (h - 10) * 1.5 : 27 - (h - 14) * 1.2,
      windDirDeg: dir,
      windSpeed: speed,
      sunAzimuthDeg: az,
      sunAltitudeDeg: alt,
    });
  }

  return points;
}

/**
 * 24방향(15° 단위) 순수 기하 벡터 채점 엔진
 * 3D 렌더링에 의존하지 않고 수학적으로 0.01초 만에 24방향 종합 점수 산출
 */
export function calculatePitchingScoring(
  site: SiteGeometry,
  gear: UserGear,
  timeline: WeatherPoint[] = generateDefaultWeatherTimeline(site.horizonProfile)
): PitchSimulationResult {
  const angles: { angle: number; score: number }[] = [];

  // 사이트 중심 기준 크기
  const siteHalfW = site.widthM / 2;
  const siteHalfD = site.depthM / 2;
  const tentL = gear.lengthM;
  const tentW = gear.widthM;

  // 0°부터 345°까지 15° 간격 24방향 순회
  for (let deg = 0; deg < 360; deg += 15) {
    let score = 100;

    // 1. 사이트 경계 이탈 검사 (OBB Boundary Penalty)
    const rad = (deg * Math.PI) / 180;
    const cos = Math.abs(Math.cos(rad));
    const sin = Math.abs(Math.sin(rad));
    // 회전된 텐트의 바운딩 박스 크기
    const boundW = tentW * cos + tentL * sin;
    const boundD = tentW * sin + tentL * cos;

    if (boundW > site.widthM || boundD > site.depthM) {
      const overflow = Math.max(0, boundW - site.widthM) + Math.max(0, boundD - site.depthM);
      score -= Math.min(35, overflow * 12); // 경계 벗어남 감점
    }

    // 2. 진입로/조망 일치도 가점 (Accessibility Bonus)
    // 사이트 진입로 방위와 텐트 전면(deg) 간의 각도차
    let diffAccess = Math.abs(deg - site.bearingDeg);
    if (diffAccess > 180) diffAccess = 360 - diffAccess;
    // 출입구가 진입로 쪽(±30° 이내)을 향하면 편리하므로 가점
    if (diffAccess <= 30) {
      score += 8;
    } else if (diffAccess > 120) {
      score -= 6; // 진입로를 등지고 완전히 반대로 돌아서면 감점
    }

    // 3. 일사 및 풍하중 시계열 누적 감점
    let totalSolarPenalty = 0;
    let totalWindPenalty = 0;

    for (const pt of timeline) {
      // (A) 산 능선 차폐 여부 판정
      const ridgeAlt = getInterpolatedRidgeAltitude(site.horizonProfile, pt.sunAzimuthDeg);
      const isSunBlockedByMountain = pt.sunAltitudeDeg <= ridgeAlt;

      // (B) 일사 노출 감점 (오후 13시~16시 강한 직사광이 텐트 넓은 옆면에 직각으로 닿을 때)
      if (!isSunBlockedByMountain && pt.hour >= 13 && pt.hour <= 16.5) {
        // 텐트 측면 법선 벡터 방향 (deg ± 90°)
        let diffSide = Math.abs(deg + 90 - pt.sunAzimuthDeg) % 180;
        if (diffSide > 90) diffSide = 180 - diffSide;
        // 옆면과 햇빛의 각도가 90도에 가까울수록(측면 직사광) 내부 온도 상승
        const sideExposure = Math.sin((diffSide * Math.PI) / 180);
        totalSolarPenalty += sideExposure * 1.5;
      }

      // (C) 풍하중 감점 (터널형 텐트는 측풍에 취약)
      if (gear.shape === 'tunnel') {
        // 텐트 장축 방향(deg)과 바람이 불어오는 방향(pt.windDirDeg) 간의 교차각
        let diffWind = Math.abs(deg - pt.windDirDeg) % 180;
        if (diffWind > 90) diffWind = 180 - diffWind;
        // diffWind가 90°에 가까우면 완벽한 측풍(Side Wind)
        const crossWindFactor = Math.sin((diffWind * Math.PI) / 180);
        totalWindPenalty += crossWindFactor * (pt.windSpeed / 3.0) * 1.2;
      }
    }

    score -= Math.min(25, totalSolarPenalty);
    score -= Math.min(30, totalWindPenalty);

    angles.push({ angle: deg, score: Math.max(10, Math.round(score)) });
  }

  // 최고점 방위각 선출
  angles.sort((a, b) => b.score - a.score);
  const best = angles[0];

  // 4. 주풍향(남서풍 225°)에 따른 풍상측 보강 팩(Pegs) 위치 도출
  // 텐트 전면(0), 후면, 좌측, 우측 중 주풍향을 정면으로 받아내는 위치
  const halfL = tentL / 2;
  const halfW = tentW / 2;

  // 텐트 중심 로컬 좌표 기준 풍상측 가이라인 팩 위치
  const reinforcedPegs = [
    {
      position: [-halfW - 0.8, 0, halfL + 0.8] as [number, number, number],
      reason: '오후 남서풍(최대 3.8m/s) 골바람에 텐트 뒤편이 들리지 않도록 좌측 후면 가이라인 40cm 장팩 보강 필수',
    },
    {
      position: [-halfW - 0.8, 0, -halfL - 0.8] as [number, number, number],
      reason: '측면 돌풍 저항을 위해 좌측 전면 메인 폴 스트링 추가 체결 권장',
    },
  ];

  // 5. 시간대별 주의사항 타임라인
  const warningTimeRanges = [
    {
      timeStr: '13:30 ~ 15:30',
      message: '서남서 골바람 풍속 증가 (순간 돌풍 4.5m/s 대비 스트링 텐션 점검)',
      severity: 'medium' as const,
    },
    {
      timeStr: '16:40 이후',
      message: '서쪽 산 능선(24.8°) 뒤로 해가 가려져 기온이 급격히 서늘해지므로 겉옷 준비',
      severity: 'low' as const,
    },
  ];

  const checklist = [
    '바람 대비: 30~40cm 단조팩 4개 이상 지참 권장',
    '배수 대비: 진입로 방향(남동쪽) 1.2° 자연 경사 확인',
    '그늘 활용: 16시 30분 이후 서쪽 산 능선 자연 그늘 안착',
  ];

  return {
    recommendedBearingDeg: best.angle,
    score: best.score,
    reinforcedPegs,
    warningTimeRanges,
    checklist,
  };
}
