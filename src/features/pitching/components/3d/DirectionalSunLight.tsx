'use client';

import React, { useMemo } from 'react';
import { getSunVector, getInterpolatedRidgeAltitude } from '../../utils/vectorMath';
import type { HorizonProfilePoint } from '../../types';

interface DirectionalSunLightProps {
  simHour: number; // 10 ~ 18
  horizonProfile?: HorizonProfilePoint[];
}

export default function DirectionalSunLight({
  simHour,
  horizonProfile = [],
}: DirectionalSunLightProps) {
  // 시간대(10~18시)에 따른 태양 방위각 및 고도각 추정 계산
  const sunInfo = useMemo(() => {
    // 한국 춘추(5월/10월) 기준 예산군 태양 궤적 근사치
    // 10:00: az 130°, alt 46°
    // 12:00: az 180°, alt 60°
    // 14:00: az 225°, alt 49°
    // 15:00: az 242°, alt 39° (오후 검증 시각 #1)
    // 16:30: az 258°, alt 24°
    // 17:00: az 268°, alt 16° (오후 검증 시각 #2 - 서쪽 능선 24.8°에 의해 산그늘 진입)
    // 18:00: az 285°, alt 4°

    const t = Math.min(Math.max(simHour, 10), 18);
    // 방위각 (10시 130° ~ 18시 285°)
    const azDeg = 130 + ((t - 10) / 8) * 155;
    // 고도각 (정오 60° 피크의 포물선 곡선)
    const normalizedHour = (t - 12) / 6; // -0.33 ~ 1.0
    const altDeg = Math.max(2, 60 - Math.pow(normalizedHour, 2) * 56);

    // 해당 방위각의 산 능선 고도각 조회
    const ridgeAltDeg = getInterpolatedRidgeAltitude(horizonProfile, azDeg);
    const isOccludedByRidge = altDeg <= ridgeAltDeg;

    // 태양 광선 단위 벡터
    const [vx, vy, vz] = getSunVector(azDeg, altDeg);
    const lightDist = 26;
    const lightPos: [number, number, number] = [
      vx * lightDist,
      Math.max(2, vy * lightDist),
      vz * lightDist,
    ];

    // 시간대별 색온도 및 밝기 (능선에 가려지면 직사광은 부드럽게 감쇄)
    let lightColor = '#FFFDF5'; // 한낮 백색광
    let intensity = isOccludedByRidge ? 0.35 : 1.7;

    if (t >= 16) {
      // 노을빛 오렌지 앰버
      lightColor = '#FFB074';
      intensity = isOccludedByRidge ? 0.25 : 1.4;
    } else if (t >= 14) {
      // 따뜻한 오후 햇살 (황금빛)
      lightColor = '#FFF0D0';
      intensity = isOccludedByRidge ? 0.35 : 1.65;
    }

    return {
      azDeg: Math.round(azDeg),
      altDeg: Math.round(altDeg),
      ridgeAltDeg: Math.round(ridgeAltDeg * 10) / 10,
      isOccludedByRidge,
      lightPos,
      lightColor,
      intensity,
    };
  }, [simHour, horizonProfile]);

  return (
    <group>
      {/* 1. 은은한 환경광 (자연스러운 숲속 앰비언트) */}
      <ambientLight intensity={sunInfo.isOccludedByRidge ? 0.65 : 0.45} color="#E0F2E9" />

      {/* 2. 하늘과 지면의 명암 대비를 살리는 헤미스피어 라이트 */}
      <hemisphereLight
        args={['#C7E8D6', '#2A3C2E', sunInfo.isOccludedByRidge ? 0.6 : 0.45]}
      />

      {/* 3. 태양 방향광 (Soft PCF 섀도맵으로 늘어지는 실제 그늘 연출) */}
      <directionalLight
        position={sunInfo.lightPos}
        intensity={sunInfo.intensity}
        color={sunInfo.lightColor}
        castShadow
        shadow-mapSize={[1024, 1024]} // 모바일 최적화 해상도
        shadow-bias={-0.0005}         // 그림자 아티팩트 방지
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
    </group>
  );
}
