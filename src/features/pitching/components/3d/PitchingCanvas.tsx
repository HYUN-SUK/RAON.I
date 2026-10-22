'use client';

import React, { useRef, useEffect } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { SiteGeometry, UserGear } from '../../types';
import SiteGround from './SiteGround';
import TunnelTent from './TunnelTent';
import Obstacles from './Obstacles';
import DirectionalSunLight from './DirectionalSunLight';

interface PitchingCanvasProps {
  site: SiteGeometry;
  gear: UserGear;
  simHour: number;
  tentRotationDeg?: number;
  reinforcedPegPositions?: [number, number, number][];
}

// 상태 변경 시 On-Demand 렌더 루프를 트리거하는 내부 컴포넌트
function DemandInvalidator({ simHour, tentRotationDeg }: { simHour: number; tentRotationDeg: number }) {
  const { invalidate } = useThree();

  useEffect(() => {
    // 시간대 또는 텐트 회전각이 변경될 때 프레임 재렌더링 트리거
    invalidate();
  }, [simHour, tentRotationDeg, invalidate]);

  return null;
}

export default function PitchingCanvas({
  site,
  gear,
  simHour,
  tentRotationDeg = 0,
  reinforcedPegPositions = [],
}: PitchingCanvasProps) {
  return (
    <div className="relative w-full h-full select-none">
      <Canvas
        shadows
        frameloop="demand" // 모바일 발열/배터리 소모 0 사수 On-Demand 렌더 루프
        dpr={[1, 1.5]}    // 모바일 레티나 과열 방지 픽셀비 제한
        camera={{
          position: [11, 8.5, 11], // 3/4 부감 구도 (38° 감성 디오라마 아이소메트릭)
          fov: 38,                 // 왜곡을 줄인 건축 시각화 화각
          near: 0.2,
          far: 120,
        }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
        }}
      >
        {/* On-Demand 렌더링 무결성 감시기 */}
        <DemandInvalidator simHour={simHour} tentRotationDeg={tentRotationDeg} />

        {/* 1. 태양 방향광 및 주변광 (능선 차폐 & Soft PCF 섀도우) */}
        <DirectionalSunLight
          simHour={simHour}
          horizonProfile={site.horizonProfile}
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
        />

        {/* 5. 3D 디오라마 터치 인터랙션 컨트롤러 */}
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
