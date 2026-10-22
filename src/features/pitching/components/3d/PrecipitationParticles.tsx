'use client';

import React, { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { PrecipitationType } from '../../types';

interface PrecipitationParticlesProps {
  type: PrecipitationType;
  speed?: number;
}

export default function PrecipitationParticles({
  type,
  speed = 1.0,
}: PrecipitationParticlesProps) {
  const pointsRef = useRef<THREE.Points>(null!);

  const particleCount = useMemo(() => {
    if (type === 'none') return 0;
    if (type === 'heavy_rain') return 1200;
    if (type === 'rain') return 600;
    if (type === 'snow') return 500;
    if (type === 'sleet') return 700;
    return 0;
  }, [type]);

  // 파티클 초기 위치 및 속도 버퍼
  const [positions, velocities] = useMemo(() => {
    if (particleCount === 0) return [new Float32Array(0), new Float32Array(0)];

    const pos = new Float32Array(particleCount * 3);
    const vel = new Float32Array(particleCount * 3);

    for (let i = 0; i < particleCount; i++) {
      // 사이트 주변 16m x 16m, 높이 0.2m ~ 12m
      pos[i * 3 + 0] = (Math.random() - 0.5) * 16;
      pos[i * 3 + 1] = Math.random() * 12 + 0.2;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 16;

      if (type === 'snow') {
        vel[i * 3 + 0] = (Math.random() - 0.5) * 0.4;
        vel[i * 3 + 1] = -(Math.random() * 1.5 + 1.0) * speed;
        vel[i * 3 + 2] = (Math.random() - 0.5) * 0.4;
      } else {
        // 비 / 폭우 / 진눈깨비
        vel[i * 3 + 0] = -0.3 * speed; // 바람에 날리는 약간의 사선 낙하
        vel[i * 3 + 1] = -(Math.random() * 8.0 + 8.0) * speed;
        vel[i * 3 + 2] = 0.1 * speed;
      }
    }
    return [pos, vel];
  }, [particleCount, type, speed]);

  // 프레임 루프에서 파티클 낙하 처리
  useFrame((_, delta) => {
    if (particleCount === 0 || !pointsRef.current) return;

    const geo = pointsRef.current.geometry;
    const posAttr = geo.attributes.position;
    const arr = posAttr.array as Float32Array;

    for (let i = 0; i < particleCount; i++) {
      arr[i * 3 + 0] += velocities[i * 3 + 0] * delta;
      arr[i * 3 + 1] += velocities[i * 3 + 1] * delta;
      arr[i * 3 + 2] += velocities[i * 3 + 2] * delta;

      // 바닥(0.1m) 이하로 떨어지면 다시 하늘 위(12m)로 리셋
      if (arr[i * 3 + 1] < 0.1) {
        arr[i * 3 + 0] = (Math.random() - 0.5) * 16;
        arr[i * 3 + 1] = 11.5 + Math.random() * 1.5;
        arr[i * 3 + 2] = (Math.random() - 0.5) * 16;
      }
    }
    posAttr.needsUpdate = true;
  });

  if (particleCount === 0) return null;

  const particleColor = type === 'snow' ? '#FFFFFF' : '#B0BEC5';
  const particleSize = type === 'snow' ? 0.12 : 0.06;

  return (
    <points ref={pointsRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          args={[positions, 3]}
        />
      </bufferGeometry>
      <pointsMaterial
        size={particleSize}
        color={particleColor}
        transparent
        opacity={type === 'snow' ? 0.85 : 0.55}
        depthWrite={false}
      />
    </points>
  );
}
