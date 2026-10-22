'use client';

import React, { useMemo } from 'react';
import * as THREE from 'three';

interface TunnelTentProps {
  lengthM?: number; // 텐트 길이 (예: 6.2m)
  widthM?: number;  // 텐트 폭 (예: 3.3m)
  heightM?: number; // 텐트 높이 (예: 2.1m)
  color?: string;   // 텐트 원단 색상
  rotationDeg?: number; // Y축 회전각 (도)
  position?: [number, number, number];
  reinforcedPegPositions?: [number, number, number][]; // 풍상측 보강 팩 강조 좌표
}

export default function TunnelTent({
  lengthM = 6.2,
  widthM = 3.3,
  heightM = 2.1,
  color = '#4B5320', // 올리브 카키
  rotationDeg = 0,
  position = [0, 0.1, 0],
  reinforcedPegPositions = [],
}: TunnelTentProps) {
  const rotationRad = (rotationDeg * Math.PI) / 180;

  // 1. 절차적 터널형 텐트 아치형 스킨 지오메트리 생성
  const tentSkinGeometry = useMemo(() => {
    // 2D 아치 단면 형상 정의 (하단 수직벽 + 상단 둥근 아치 지붕)
    const shape = new THREE.Shape();
    const halfW = widthM / 2;
    const wallH = heightM * 0.45; // 수직 벽면 높이
    const roofH = heightM;        // 정상 최고점

    shape.moveTo(-halfW, 0);
    shape.lineTo(-halfW, wallH);
    // 상단 둥근 돔 아치 곡선 (베지에 곡선)
    shape.quadraticCurveTo(-halfW * 0.5, roofH, 0, roofH);
    shape.quadraticCurveTo(halfW * 0.5, roofH, halfW, wallH);
    shape.lineTo(halfW, 0);
    shape.closePath();

    // Z축 방향으로 extrude (길이만큼 입체화)
    const extrudeSettings: THREE.ExtrudeGeometryOptions = {
      steps: 16,
      depth: lengthM,
      bevelEnabled: true,
      bevelThickness: 0.08,
      bevelSize: 0.08,
      bevelSegments: 4,
    };

    const geom = new THREE.ExtrudeGeometry(shape, extrudeSettings);
    // 중심축을 텐트 가운데로 정렬
    geom.center();
    // 바닥면이 y=0에 오도록 상향 이동
    geom.translate(0, heightM / 2, 0);
    geom.computeVertexNormals();
    return geom;
  }, [widthM, lengthM, heightM]);

  // 2. 4개의 아치형 폴대 라인 (Rib Arches) 생성
  const poleRibs = useMemo(() => {
    const ribs: { z: number }[] = [];
    const count = 4; // 표준 4폴 터널형
    const step = (lengthM * 0.85) / (count - 1);
    const startZ = -(lengthM * 0.85) / 2;

    for (let i = 0; i < count; i++) {
      ribs.push({ z: startZ + i * step });
    }
    return ribs;
  }, [lengthM]);

  // 아치 폴대 1개의 튜브 곡선 정의
  const poleArchGeometry = useMemo(() => {
    const halfW = widthM / 2 + 0.03;
    const wallH = heightM * 0.45;
    const roofH = heightM + 0.03;

    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-halfW, 0, 0),
      new THREE.Vector3(-halfW * 0.98, wallH, 0),
      new THREE.Vector3(0, roofH, 0),
      new THREE.Vector3(halfW * 0.98, wallH, 0),
      new THREE.Vector3(halfW, 0, 0),
    ]);

    return new THREE.TubeGeometry(curve, 32, 0.028, 8, false);
  }, [widthM, heightM]);

  // 3. 지면 스트링(가이라인) 라인 세트
  const guyLines = useMemo(() => {
    const halfW = widthM / 2;
    const halfL = lengthM / 2;
    const pegDist = 0.8; // 지면 팩 박는 외곽 거리

    return [
      // 전면 좌우 가이라인
      { from: [-halfW * 0.6, heightM * 0.6, -halfL], to: [-halfW - pegDist, 0, -halfL - pegDist] },
      { from: [halfW * 0.6, heightM * 0.6, -halfL], to: [halfW + pegDist, 0, -halfL - pegDist] },
      // 후면 좌우 가이라인
      { from: [-halfW * 0.6, heightM * 0.6, halfL], to: [-halfW - pegDist, 0, halfL + pegDist] },
      { from: [halfW * 0.6, heightM * 0.6, halfL], to: [halfW + pegDist, 0, halfL + pegDist] },
    ];
  }, [widthM, lengthM, heightM]);

  return (
    <group position={position} rotation={[0, rotationRad, 0]}>
      {/* 1. 텐트 본체 스킨 (무광 립스탑 원단) */}
      <mesh
        geometry={tentSkinGeometry}
        castShadow
        receiveShadow
      >
        <meshStandardMaterial
          color={color}
          roughness={0.72} // 감성 무광 캔버스/나일론 질감
          metalness={0.06}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 2. 전면 캐노피 출입구 지퍼 라인 / 스커트 디테일 */}
      <mesh position={[0, heightM * 0.4, -lengthM / 2 - 0.02]} receiveShadow>
        <planeGeometry args={[widthM * 0.6, heightM * 0.7]} />
        <meshStandardMaterial
          color="#38401C" // 톤다운된 출입문 메시
          roughness={0.85}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* 3. 4개의 두랄루민 아치형 폴대 라인 */}
      {poleRibs.map((rib, idx) => (
        <mesh
          key={idx}
          geometry={poleArchGeometry}
          position={[0, 0, rib.z]}
          castShadow
        >
          <meshStandardMaterial
            color="#E5E7EB" // 밝은 알루미늄 실버 폴대
            roughness={0.3}
            metalness={0.85}
          />
        </mesh>
      ))}

      {/* 4. 지면 가이라인 (스트링) & 팩 (Pegs) */}
      {guyLines.map((line, idx) => {
        const points = [
          new THREE.Vector3(...line.from as [number, number, number]),
          new THREE.Vector3(...line.to as [number, number, number]),
        ];
        const lineGeom = new THREE.BufferGeometry().setFromPoints(points);

        return (
          <group key={idx}>
            {/* 스트링 선 */}
            <primitive object={new THREE.Line(
              lineGeom,
              new THREE.LineBasicMaterial({ color: '#FCD34D', linewidth: 1.5 })
            )} />
            {/* 지면 단조 팩 앵커 */}
            <mesh position={line.to as [number, number, number]} castShadow>
              <cylinderGeometry args={[0.02, 0.015, 0.15, 8]} />
              <meshStandardMaterial color="#B91C1C" roughness={0.4} /> {/* 시인성 높은 붉은색 팩 */}
            </mesh>
            {/* 풍상측 보강 팩 강조 하이라이트 링 */}
            {reinforcedPegPositions.some((pos) => {
              const [px, , pz] = pos;
              const [tx, , tz] = line.to;
              return Math.hypot(px - tx, pz - tz) < 0.3;
            }) && (
              <mesh position={[line.to[0], 0.02, line.to[2]]} rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.1, 0.22, 24]} />
                <meshBasicMaterial color="#F59E0B" transparent opacity={0.85} side={THREE.DoubleSide} />
              </mesh>
            )}
          </group>
        );
      })}
    </group>
  );
}
