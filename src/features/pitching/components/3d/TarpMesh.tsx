'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface TarpMeshProps {
  type?: 'recta_tarp' | 'hexa_tarp';
  widthM?: number;    // 가로 폭 (예: 4.4m)
  lengthM?: number;   // 세로 길이 (예: 4.0m)
  heightM?: number;   // 메인 폴대 높이 (예: 2.4m)
  color?: string;     // 원단 색상 (샌드 베이지, 카키 등)
  position?: [number, number, number];
  rotationDeg?: number;
  windSpeed?: number;
}

export default function TarpMesh({
  type = 'recta_tarp',
  widthM = 4.4,
  lengthM = 4.0,
  heightM = 2.4,
  color = '#C2B280', // 샌드 베이지
  position = [0, 0, 0],
  rotationDeg = 0,
  windSpeed = 2.5,
}: TarpMeshProps) {
  const rotationRad = (rotationDeg * Math.PI) / 180;
  const tarpGroupRef = useRef<THREE.Group>(null!);

  const sideH = heightM * 0.72; // 사이드 높이
  const halfW = widthM / 2;
  const halfL = lengthM / 2;

  // 1. 타프 윙 지오메트리 (능선 중심이 높고 양 날개가 완만하게 내려오는 형태)
  const tarpGeometry = useMemo(() => {
    const geom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const indices: number[] = [];

    if (type === 'hexa_tarp') {
      // 헥사(육각) 타프: 중심 2점 + 좌우 4날개점
      vertices.push(
        0, heightM, -halfL,        // 0: 전면 메인폴 꼭지점
        0, heightM, halfL,         // 1: 후면 메인폴 꼭지점
        -halfW * 0.9, sideH, -halfL * 0.3, // 2: 좌전 날개
        -halfW * 0.9, sideH, halfL * 0.3,  // 3: 좌후 날개
        halfW * 0.9, sideH, -halfL * 0.3,  // 4: 우전 날개
        halfW * 0.9, sideH, halfL * 0.3    // 5: 우후 날개
      );
      // 좌측 삼각면들
      indices.push(0, 2, 1, 2, 3, 1);
      // 우측 삼각면들
      indices.push(0, 1, 4, 1, 5, 4);
    } else {
      // 렉타(사각) 타프: A형 지붕 단면 형태
      vertices.push(
        // 중앙 마루선 (메인 능선)
        0, heightM, -halfL, // 0
        0, heightM, halfL,  // 1
        // 좌측 사이드 날개
        -halfW, sideH, -halfL, // 2
        -halfW, sideH, halfL,  // 3
        // 우측 사이드 날개
        halfW, sideH, -halfL,  // 4
        halfW, sideH, halfL    // 5
      );
      // 좌측 패널
      indices.push(0, 2, 1, 2, 3, 1);
      // 우측 패널
      indices.push(0, 1, 4, 1, 5, 4);
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [type, widthM, lengthM, heightM, halfW, halfL, sideH]);

  // 2. 강풍 시 타프 미세 펄럭임(흔들림) 물리 애니메이션
  useFrame(({ clock }) => {
    if (!tarpGroupRef.current) return;
    if (windSpeed >= 5.0) {
      const t = clock.getElapsedTime();
      const intensity = Math.min(0.04, (windSpeed - 4.0) * 0.005);
      tarpGroupRef.current.rotation.z = Math.sin(t * (windSpeed * 1.5)) * intensity;
      tarpGroupRef.current.position.y = (position[1] || 0) + Math.cos(t * (windSpeed * 2)) * (intensity * 0.3);
    } else {
      tarpGroupRef.current.rotation.z = 0;
      tarpGroupRef.current.position.y = position[1] || 0;
    }
  });

  // 3. 지면 메인 폴대 2개 위치
  const frontPolePos: [number, number, number] = [0, heightM / 2, -halfL];
  const backPolePos: [number, number, number] = [0, heightM / 2, halfL];

  return (
    <group position={position} rotation={[0, rotationRad, 0]}>
      <group ref={tarpGroupRef}>
        {/* 타프 윙 스킨 */}
        <mesh geometry={tarpGeometry} castShadow receiveShadow>
          <meshStandardMaterial
            color={color}
            roughness={0.65}
            metalness={0.08}
            side={THREE.DoubleSide}
          />
        </mesh>

        {/* 전면 메인 두랄루민 폴대 */}
        <mesh position={frontPolePos} castShadow>
          <cylinderGeometry args={[0.024, 0.024, heightM, 8]} />
          <meshStandardMaterial color="#E5E7EB" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* 후면 메인 두랄루민 폴대 */}
        <mesh position={backPolePos} castShadow>
          <cylinderGeometry args={[0.024, 0.024, heightM, 8]} />
          <meshStandardMaterial color="#E5E7EB" roughness={0.3} metalness={0.8} />
        </mesh>
      </group>
    </group>
  );
}
