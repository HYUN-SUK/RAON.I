'use client';

import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface BonfireProps {
  position?: [number, number, number];
  intensity?: number;
  isActive?: boolean;
}

export default function Bonfire({
  position = [0, 0.05, 2.8], // 텐트 입구 앞마당 위치
  intensity = 2.0,
  isActive = true,
}: BonfireProps) {
  const lightRef = useRef<THREE.PointLight>(null!);
  const flameMeshRef = useRef<THREE.Mesh>(null!);

  // 프레임 루프에서 자연스러운 장작불 일렁임(Flicker) 연출
  useFrame(({ clock }) => {
    if (!isActive) return;
    const t = clock.getElapsedTime();
    // 3개 주파수의 복합 삼각파로 유기적인 불꽃 깜빡임 생성
    const flicker =
      Math.sin(t * 12.0) * 0.18 +
      Math.sin(t * 23.0) * 0.12 +
      Math.sin(t * 7.5) * 0.15;

    if (lightRef.current) {
      lightRef.current.intensity = Math.max(0.6, intensity + flicker);
    }
    if (flameMeshRef.current) {
      const s = 1.0 + flicker * 0.25;
      flameMeshRef.current.scale.set(s, 1.0 + flicker * 0.4, s);
    }
  });

  if (!isActive) return null;

  return (
    <group position={position}>
      {/* 1. 화롯대 받침대 (스탠드형 육각 메탈 화롯대) */}
      <mesh position={[0, 0.08, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.32, 0.22, 0.12, 6]} />
        <meshStandardMaterial color="#2B2D2F" roughness={0.65} metalness={0.7} />
      </mesh>

      {/* 2. 교차된 장작 나무 (3개) */}
      <mesh position={[0, 0.15, 0]} rotation={[0.2, 0.4, 0.3]} castShadow>
        <cylinderGeometry args={[0.045, 0.05, 0.45, 6]} />
        <meshStandardMaterial color="#3E2723" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.15, 0]} rotation={[-0.3, 1.2, -0.2]} castShadow>
        <cylinderGeometry args={[0.04, 0.045, 0.42, 6]} />
        <meshStandardMaterial color="#4E342E" roughness={0.9} />
      </mesh>
      <mesh position={[0, 0.16, 0]} rotation={[0.1, -0.8, 0.4]} castShadow>
        <cylinderGeometry args={[0.04, 0.04, 0.44, 6]} />
        <meshStandardMaterial color="#3E2723" roughness={0.9} />
      </mesh>

      {/* 3. 붉게 타오르는 중심 숯/불꽃 코어 메쉬 */}
      <mesh ref={flameMeshRef} position={[0, 0.22, 0]}>
        <coneGeometry args={[0.16, 0.32, 7]} />
        <meshBasicMaterial color="#FF4500" transparent opacity={0.92} />
      </mesh>

      {/* 4. 은은하고 따뜻한 불멍 포인트 라이트 (주변 파쇄석 및 텐트 스킨 조명) */}
      <pointLight
        ref={lightRef}
        position={[0, 0.35, 0]}
        color="#FF8A00"
        intensity={intensity}
        distance={7.5}
        decay={2}
        castShadow
        shadow-bias={-0.001}
      />

      {/* 5. 바닥 지면을 은은하게 물들이는 붉은 필라이트 */}
      <pointLight
        position={[0, 0.12, 0]}
        color="#FF3D00"
        intensity={intensity * 0.4}
        distance={3.5}
        decay={1.5}
      />
    </group>
  );
}
