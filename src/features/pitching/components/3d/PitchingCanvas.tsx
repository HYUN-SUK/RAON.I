'use client';

import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type {
  SiteGeometry,
  UserGear,
  PlacedGearItem,
  WeatherLightingParams,
  WeatherCaseCode,
} from '../../types';
import SiteGround from './SiteGround';
import TunnelTent from './TunnelTent';
import TarpMesh from './TarpMesh';
import Obstacles from './Obstacles';
import DirectionalSunLight from './DirectionalSunLight';
import PrecipitationParticles from './PrecipitationParticles';
import Bonfire from './Bonfire';

interface PitchingCanvasProps {
  site: SiteGeometry;
  gear?: UserGear;
  placedGears?: PlacedGearItem[];
  simHour: number;
  dayIndex?: number;
  weatherCase?: WeatherCaseCode;
  windSpeed?: number;
  tentRotationDeg?: number;
  reinforcedPegPositions?: [number, number, number][];
  weatherParams?: WeatherLightingParams;
}

// 상태 변경 시 On-Demand 렌더 루프를 트리거하는 내부 컴포넌트
function DemandInvalidator({
  simHour,
  tentRotationDeg,
  weatherCase,
}: {
  simHour: number;
  tentRotationDeg: number;
  weatherCase?: WeatherCaseCode;
}) {
  const { invalidate } = useThree();

  useEffect(() => {
    invalidate();
  }, [simHour, tentRotationDeg, weatherCase, invalidate]);

  return null;
}

export default function PitchingCanvas({
  site,
  gear,
  placedGears = [],
  simHour,
  dayIndex = 1,
  weatherCase = 'clear',
  windSpeed = 2.5,
  tentRotationDeg = 0,
  reinforcedPegPositions = [],
  weatherParams,
}: PitchingCanvasProps) {
  // 강수 파티클 또는 야간 모닥불이 활성화된 경우 부드러운 애니메이션을 위해 always 루프 가동
  const hasAnimation =
    (weatherParams?.precipitationType && weatherParams.precipitationType !== 'none') ||
    weatherParams?.isBonfireActive ||
    windSpeed >= 5.0;

  return (
    <div
      className="relative w-full h-full select-none"
      style={{
        backgroundColor: weatherParams?.skyBgColor || '#87CEEB',
        transition: 'background-color 0.6s ease',
      }}
    >
      <Canvas
        shadows
        frameloop={hasAnimation ? 'always' : 'demand'}
        dpr={[1, 1.5]}
        camera={{
          position: [11, 8.5, 11],
          fov: 38,
          near: 0.2,
          far: 120,
        }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true,
        }}
      >
        <DemandInvalidator
          simHour={simHour}
          tentRotationDeg={tentRotationDeg}
          weatherCase={weatherCase}
        />

        {/* 1. 태양 방향광 및 주변광 */}
        <DirectionalSunLight
          simHour={simHour}
          dayIndex={dayIndex}
          weatherCase={weatherCase}
          windSpeed={windSpeed}
          horizonProfile={site.horizonProfile}
          weatherParams={weatherParams}
        />

        {/* 2. 파쇄석 바닥 & 원경 산 능선 실루엣 */}
        <SiteGround
          widthM={site.widthM}
          depthM={site.depthM}
          horizonProfile={site.horizonProfile}
        />

        {/* 3. 장애물 (나무, 배전반, 차량) */}
        <Obstacles obstacles={site.obstacles} />

        {/* 4. 복수 장비 (멀티 텐트 및 타프) 렌더링 */}
        {placedGears.length > 0 ? (
          placedGears.map((item) => {
            if (item.type.includes('tarp')) {
              return (
                <TarpMesh
                  key={item.id}
                  type={item.type === 'recta_tarp' ? 'recta_tarp' : 'hexa_tarp'}
                  widthM={item.widthM}
                  lengthM={item.lengthM}
                  heightM={item.heightM}
                  color={item.color}
                  position={[item.x, 0.05, item.z]}
                  rotationDeg={item.rotationDeg}
                  windSpeed={windSpeed}
                />
              );
            }
            // 텐트 렌더링
            return (
              <TunnelTent
                key={item.id}
                lengthM={item.lengthM}
                widthM={item.widthM}
                heightM={item.heightM}
                color={item.color}
                position={[item.x, 0.1, item.z]}
                rotationDeg={item.rotationDeg}
                reinforcedPegPositions={reinforcedPegPositions}
                isLanternOn={weatherParams?.isTentLanternOn}
                windSpeed={windSpeed}
              />
            );
          })
        ) : (
          /* 기존 단일 텐트 fallback */
          gear && (
            <TunnelTent
              lengthM={gear.lengthM}
              widthM={gear.widthM}
              heightM={gear.heightM}
              color={gear.color}
              rotationDeg={tentRotationDeg}
              reinforcedPegPositions={reinforcedPegPositions}
              isLanternOn={weatherParams?.isTentLanternOn}
              windSpeed={windSpeed}
            />
          )
        )}

        {/* 5. 야간 감성 모닥불(화롯대 불멍) 렌더링 */}
        <Bonfire
          isActive={weatherParams?.isBonfireActive}
          intensity={weatherParams?.bonfireIntensity || 2.0}
        />

        {/* 6. 3D 강수 파티클 */}
        {weatherParams?.precipitationType && (
          <PrecipitationParticles
            type={weatherParams.precipitationType}
            speed={weatherParams.precipitationSpeed}
          />
        )}

        {/* 7. 터치 컨트롤러 */}
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={5.5}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2.06}
          target={[0, 0.8, 0]}
        />
      </Canvas>
    </div>
  );
}
