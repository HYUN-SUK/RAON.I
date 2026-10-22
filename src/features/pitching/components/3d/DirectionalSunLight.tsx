'use client';

import React, { useMemo } from 'react';
import type { HorizonProfilePoint, WeatherLightingParams, WeatherCaseCode } from '../../types';
import { calculateWeatherLighting } from '../../engine/weatherLightingEngine';

interface DirectionalSunLightProps {
  simHour: number;
  dayIndex?: number;
  weatherCase?: WeatherCaseCode;
  windSpeed?: number;
  horizonProfile?: HorizonProfilePoint[];
  weatherParams?: WeatherLightingParams;
}

export default function DirectionalSunLight({
  simHour,
  dayIndex = 1,
  weatherCase = 'clear',
  windSpeed = 2.5,
  horizonProfile = [],
  weatherParams: directParams,
}: DirectionalSunLightProps) {
  // 직접 파라미터가 전달되지 않았을 경우 계산 엔진 실행
  const lighting = useMemo(() => {
    if (directParams) return directParams;
    return calculateWeatherLighting({
      hour: simHour,
      dayIndex,
      weatherCase,
      windSpeed,
      horizonProfile,
    });
  }, [directParams, simHour, dayIndex, weatherCase, windSpeed, horizonProfile]);

  return (
    <group>
      {/* 1. 3D 씬 대기 안개 (Fog) */}
      <fog attach="fog" args={[lighting.fogColor, 15, Math.max(30, 1 / (lighting.fogDensity + 0.0001))]} />

      {/* 2. 환경광 (Ambient) */}
      <ambientLight intensity={lighting.ambientIntensity} color={lighting.ambientColor} />

      {/* 3. 하늘과 지면의 헤미스피어 라이트 */}
      <hemisphereLight
        args={[
          lighting.hemiSkyColor,
          lighting.hemiGroundColor,
          lighting.hemiIntensity,
        ]}
      />

      {/* 4. 태양 방향광 (Soft PCF 섀도맵으로 늘어지는 실제 그늘 연출) */}
      <directionalLight
        position={lighting.sunPos}
        intensity={lighting.sunIntensity}
        color={lighting.sunColor}
        castShadow={lighting.shadowOpacity > 0.1}
        shadow-mapSize={[1024, 1024]} // 모바일 최적화 해상도
        shadow-bias={-0.0005}         // 그림자 아티팩트 방지
        shadow-camera-near={0.5}
        shadow-camera-far={60}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />

      {/* 5. 야간 텐트 감성 랜턴 조명 (일몰 후 19:30 ~ 05:30) */}
      {lighting.isTentLanternOn && (
        <group position={[0, 1.1, 0]}>
          {/* 랜턴 발광 포인트 라이트 */}
          <pointLight
            color="#FFB74D"
            intensity={2.8}
            distance={6.5}
            decay={2}
          />
          {/* 내부 은은한 필라이트 */}
          <pointLight
            color="#FFE082"
            intensity={1.2}
            distance={3.5}
            decay={1}
          />
        </group>
      )}

      {/* 6. 뇌우 시 간헐적 번개 순간 플래시 라이트 */}
      {lighting.isLightning && (
        <pointLight
          position={[0, 15, 0]}
          color="#E1F5FE"
          intensity={6.0}
          distance={40}
        />
      )}
    </group>
  );
}
