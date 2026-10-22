'use client';

import React from 'react';
import type { SiteObstacle } from '../../types';

interface ObstaclesProps {
  obstacles?: SiteObstacle[];
}

export default function Obstacles({ obstacles = [] }: ObstaclesProps) {
  return (
    <group>
      {obstacles.map((obs, idx) => {
        if (obs.type === 'tree') {
          const height = obs.height || 6.5;
          const crownRadius = obs.radius || 2.4;
          const trunkHeight = height * 0.45;
          const crownHeight = height * 0.55;

          return (
            <group key={idx} position={[obs.x, 0.1, obs.y]}>
              {/* 나무 줄기 (Trunk) */}
              <mesh position={[0, trunkHeight / 2, 0]} castShadow receiveShadow>
                <cylinderGeometry args={[0.18, 0.24, trunkHeight, 10]} />
                <meshStandardMaterial
                  color="#4A3525" // 진한 원목 갈색
                  roughness={0.9}
                />
              </mesh>

              {/* 볼륨감 있는 풍성한 활엽수 수관 (Deciduous Crown - 감성 디오라마 로우폴리) */}
              <mesh
                position={[0, trunkHeight + crownHeight * 0.45, 0]}
                castShadow
                receiveShadow
              >
                <dodecahedronGeometry args={[crownRadius, 1]} />
                <meshStandardMaterial
                  color="#2D5A27" // 딥 올리브 그린
                  roughness={0.82}
                  flatShading
                />
              </mesh>

              {/* 상단 포인트 잎 볼륨 */}
              <mesh
                position={[0.2, trunkHeight + crownHeight * 0.75, 0.1]}
                castShadow
              >
                <dodecahedronGeometry args={[crownRadius * 0.65, 1]} />
                <meshStandardMaterial
                  color="#3D7534" // 밝은 숲초록 포인트
                  roughness={0.8}
                  flatShading
                />
              </mesh>
            </group>
          );
        }

        if (obs.type === 'car') {
          const w = obs.width || 1.9;
          const l = obs.length || 4.8;
          const h = obs.height || 1.8;

          return (
            <group key={idx} position={[obs.x, 0.1, obs.y]}>
              {/* SUV 하부 바디 */}
              <mesh position={[0, h * 0.35, 0]} castShadow receiveShadow>
                <boxGeometry args={[w, h * 0.6, l]} />
                <meshStandardMaterial
                  color="#374151" // 차콜 그레이 캠핑카 바디
                  roughness={0.4}
                  metalness={0.5}
                />
              </mesh>

              {/* SUV 상부 캐빈 루프 */}
              <mesh position={[0, h * 0.75, -l * 0.05]} castShadow>
                <boxGeometry args={[w * 0.88, h * 0.45, l * 0.6]} />
                <meshStandardMaterial
                  color="#1F2937"
                  roughness={0.3}
                  metalness={0.6}
                />
              </mesh>
            </group>
          );
        }

        return null;
      })}
    </group>
  );
}
