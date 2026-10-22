'use client';

import React, { useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { SiteGeometry, UserGear, WeatherLightingParams, WeatherCaseCode } from '../../types';
import SiteGround from './SiteGround';
import TunnelTent from './TunnelTent';
import Obstacles from './Obstacles';
import DirectionalSunLight from './DirectionalSunLight';
import PrecipitationParticles from './PrecipitationParticles';

interface PitchingCanvasProps {
  site: SiteGeometry;
  gear: UserGear;
  simHour: number;
  dayIndex?: number;
  weatherCase?: WeatherCaseCode;
  windSpeed?: number;
  tentRotationDeg?: number;
  reinforcedPegPositions?: [number, number, number][];
  weatherParams?: WeatherLightingParams;
  canvasRef?: React.RefObject<HTMLCanvasElement | null>;
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
  simHour,
  dayIndex = 1,
  weatherCase = 'clear',
  windSpeed = 2.5,
  tentRotationDeg = 0,
  reinforcedPegPositions = [],
  weatherParams,
}: PitchingCanvasProps) {
  // 강수 파티클이 활성화된 경우 부드러운 파티클 프레임을 위해 frameloop을 조절
  const hasPrecipitation =
    weatherParams?.precipitationType && weatherParams.precipitationType !== 'none';

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
        frameloop={hasPrecipitation ? 'always' : 'demand'} // 파티클 없을 땐 발열 0 On-Demand 루프
        dpr={[1, 1.5]} // 모바일 발열 방지 픽셀비 제한
        camera={{
          position: [11, 8.5, 11], // 3/4 부감 구도 (38° 감성 디오라마 아이소메트릭)
          fov: 38,                 // 왜곡을 줄인 건축 시각화 화각
          near: 0.2,
          far: 120,
        }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          preserveDrawingBuffer: true, // WBS 5 Canvas 3D 스크린샷 캡처 다운로드 지원
        }}
      >
        {/* On-Demand 렌더링 무결성 감시기 */}
        <DemandInvalidator
          simHour={simHour}
          tentRotationDeg={tentRotationDeg}
          weatherCase={weatherCase}
        />

        {/* 1. 태양 방향광 및 주변광 (12대 날씨 매트릭스, 야간 랜턴, 씬 안개) */}
        <DirectionalSunLight
          simHour={simHour}
          dayIndex={dayIndex}
          weatherCase={weatherCase}
          windSpeed={windSpeed}
          horizonProfile={site.horizonProfile}
          weatherParams={weatherParams}
        />

        {/* 2. 파쇄석 바닥 & 주변 자연 지형 & 원경 산 능선 실루엣 */}
        <SiteGround
          widthM={site.widthM}
          depthM={site.depthM}
          horizonProfile={site.horizonProfile}
        />

        {/* 3. 활엽수 나무 및 주차 차량 장애물 */}
        <Obstacles obstacles={site.obstacles} />

        {/* 4. 절차적 터널형 텐트 (아치형 프레임, 폴대, 스트링, 팩) */}
        <TunnelTent
          lengthM={gear.lengthM}
          widthM={gear.widthM}
          heightM={gear.heightM}
          color={gear.color}
          rotationDeg={tentRotationDeg}
          reinforcedPegPositions={reinforcedPegPositions}
          isLanternOn={weatherParams?.isTentLanternOn}
        />

        {/* 5. 3D 강수 파티클 (비, 함박눈, 진눈깨비) */}
        {weatherParams?.precipitationType && (
          <PrecipitationParticles
            type={weatherParams.precipitationType}
            speed={weatherParams.precipitationSpeed}
          />
        )}

        {/* 6. 3D 디오라마 터치 인터랙션 컨트롤러 */}
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={5.5}
          maxDistance={26}
          maxPolarAngle={Math.PI / 2.06} // 지면 아래로 카메라가 내려가지 않도록 락
          target={[0, 0.8, 0]}          // 텐트 중심을 타깃으로 회전
        />
      </Canvas>
    </div>
  );
}
