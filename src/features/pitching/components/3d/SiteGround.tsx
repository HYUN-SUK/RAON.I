'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { ContactShadows } from '@react-three/drei';
import type { HorizonProfilePoint } from '../../types';

interface SiteGroundProps {
  widthM: number;
  depthM: number;
  horizonProfile?: HorizonProfilePoint[];
}

export default function SiteGround({
  widthM,
  depthM,
  horizonProfile = [],
}: SiteGroundProps) {
  // 16방위 능선 고도각을 바탕으로 원경 산 능선 실루엣 3D 링(Ring) 버텍스 생성
  const ridgeGeometry = useMemo(() => {
    if (!horizonProfile || horizonProfile.length === 0) return null;

    const radius = 40; // 사이트 중심으로부터 원경 거리
    const pointsCount = 64; // 부드러운 산세 보간 점 개수
    const vertices: number[] = [];
    const indices: number[] = [];

    // 방위각 오름차순 정렬
    const sorted = [...horizonProfile].sort((a, b) => a.az - b.az);

    for (let i = 0; i < pointsCount; i++) {
      const azDeg = (i / pointsCount) * 360;
      const azRad = (azDeg * Math.PI) / 180;

      // 해당 방위각의 능선 고도각(alt) 선형 보간
      let altDeg = 15;
      for (let j = 0; j < sorted.length; j++) {
        const p1 = sorted[j];
        const p2 = sorted[(j + 1) % sorted.length];
        let span = p2.az - p1.az;
        if (span < 0) span += 360;
        let offset = azDeg - p1.az;
        if (offset < 0) offset += 360;

        if (offset <= span) {
          const ratio = span > 0 ? offset / span : 0;
          altDeg = p1.alt + (p2.alt - p1.alt) * ratio;
          break;
        }
      }

      // 고도각(deg)을 높이(m)로 변환: height = radius * tan(altRad)
      const height = Math.max(1, radius * Math.tan((altDeg * Math.PI) / 180));

      const x = radius * Math.sin(azRad);
      const z = -radius * Math.cos(azRad);

      // 바닥 점
      vertices.push(x, -0.5, z);
      // 능선 정상 점
      vertices.push(x, height, z);
    }

    // 삼각형 인덱스 구성 (스트립 연결)
    for (let i = 0; i < pointsCount; i++) {
      const next = (i + 1) % pointsCount;
      const b1 = i * 2;
      const t1 = i * 2 + 1;
      const b2 = next * 2;
      const t2 = next * 2 + 1;

      // 면 1
      indices.push(b1, t1, b2);
      // 면 2
      indices.push(b2, t1, t2);
    }

    const geom = new THREE.BufferGeometry();
    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setIndex(indices);
    geom.computeVertexNormals();
    return geom;
  }, [horizonProfile]);

  return (
    <group>
      {/* 1. 광활한 주변 자연 베이스 (깊은 숲속 흙/잔디 지면) */}
      <mesh receiveShadow position={[0, -0.15, 0]}>
        <cylinderGeometry args={[28, 30, 0.3, 48]} />
        <meshStandardMaterial
          color="#1e2e22" // 딥 포레스트 그린
          roughness={0.95}
          metalness={0.05}
        />
      </mesh>

      {/* 2. 철수네 사이트 파쇄석 슬랩 (8m x 7m) */}
      <mesh receiveShadow position={[0, 0.05, 0]}>
        <boxGeometry args={[widthM, 0.1, depthM]} />
        <meshStandardMaterial
          color="#9CA3AF" // 차분한 파쇄석 그레이 (#9CA3AF)
          roughness={0.88}
          metalness={0.08}
        />
      </mesh>

      {/* 3. 파쇄석 사이트 테두리 경계선 (나무 데크/석재 경계 블록) */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[widthM + 0.25, 0.08, depthM + 0.25]} />
        <meshStandardMaterial
          color="#4B5563"
          roughness={0.9}
          metalness={0.1}
          wireframe
        />
      </mesh>

      {/* 4. 진입로 화살표 가이드 (앞쪽 남동향 안내) */}
      <group position={[0, 0.11, depthM / 2 + 0.6]}>
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[1.6, 0.5]} />
          <meshBasicMaterial color="#2E7D47" transparent opacity={0.7} />
        </mesh>
      </group>

      {/* 5. 텐트 접지 그림자 (ContactShadows: 지면 안착감) */}
      <ContactShadows
        position={[0, 0.08, 0]}
        opacity={0.65}
        scale={widthM * 1.3}
        blur={1.8}
        far={3.0}
        resolution={512}
        color="#08140c"
      />

      {/* 6. 원경 산 능선 실루엣 메시 (16방위 국토정보 표고 연동) */}
      {ridgeGeometry && (
        <mesh geometry={ridgeGeometry}>
          <meshBasicMaterial
            color="#142419" // 차분한 원경 산 실루엣
            side={THREE.DoubleSide}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}
    </group>
  );
}
