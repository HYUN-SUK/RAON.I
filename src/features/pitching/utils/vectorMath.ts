/**
 * 가상 피칭 & 날씨 시뮬레이터 벡터 연산 엔진
 * 
 * 기상학적 풍향(0~360°)을 수학적 벡터로 분해/합성하고,
 * 태양 궤적 벡터와 텐트 방위각 간의 기하학적 교차각을 계산합니다.
 */

export interface WindVector {
  u: number; // 동서 성분 (East-West, m/s)
  v: number; // 남북 성분 (North-South, m/s)
  speed: number;     // 합성 풍속 (m/s)
  directionDeg: number; // 합성 풍향 (0~360°, 0=북풍, 90=동풍)
}

/**
 * 기상학적 풍향(바람이 불어오는 방향)과 풍속을 직교 좌표 벡터 성분(u, v)으로 분해
 * @param directionDeg 풍향 (0~360°, 0=북, 90=동, 180=남, 270=서)
 * @param speed 풍속 (m/s)
 */
export function decomposeWindVector(directionDeg: number, speed: number): { u: number; v: number } {
  const rad = (directionDeg * Math.PI) / 180;
  // 기상학적 정의: 북풍(0°)은 북쪽에서 남쪽(-y)으로 붊
  const u = -speed * Math.sin(rad);
  const v = -speed * Math.cos(rad);
  return { u, v };
}

/**
 * 여러 시간대의 풍향/풍속 벡터들을 삼각함수 벡터 성분으로 합성하여 평균 주풍향 및 평균 풍속 산출
 * (단순 각도 산술평균 오류: 350°와 10°의 평균이 180° 남풍이 아닌 0° 북풍으로 정확히 합성됨)
 */
export function aggregateWindVectors(
  winds: { directionDeg: number; speed: number }[]
): WindVector {
  if (winds.length === 0) {
    return { u: 0, v: 0, speed: 0, directionDeg: 0 };
  }

  let sumU = 0;
  let sumV = 0;

  for (const w of winds) {
    const { u, v } = decomposeWindVector(w.directionDeg, w.speed);
    sumU += u;
    sumV += v;
  }

  const avgU = sumU / winds.length;
  const avgV = sumV / winds.length;
  const speed = Math.sqrt(avgU * avgU + avgV * avgV);

  // 벡터로부터 바람이 불어오는 방향(meteorological wind direction) 복원
  // rad = atan2(-u, -v)
  let dirRad = Math.atan2(-avgU, -avgV);
  let directionDeg = (dirRad * 180) / Math.PI;
  if (directionDeg < 0) {
    directionDeg += 360;
  }

  return {
    u: avgU,
    v: avgV,
    speed: Math.round(speed * 10) / 10,
    directionDeg: Math.round(directionDeg),
  };
}

/**
 * 태양 방위각(0~360°)과 고도각(0~90°)을 3D 구면 좌표계 단위 방향 벡터(Sun Ray Vector)로 변환
 * Three.js 3D 월드 좌표계: +X = 동(East), +Y = 위(Up), -Z = 북(North)
 */
export function getSunVector(azimuthDeg: number, altitudeDeg: number): [number, number, number] {
  const altRad = (altitudeDeg * Math.PI) / 180;
  const azRad = (azimuthDeg * Math.PI) / 180;

  // y: 태양 고도
  const y = Math.sin(altRad);
  // 수평 투영 크기
  const horiz = Math.cos(altRad);

  // Three.js 좌표계: x = horiz * sin(az), z = -horiz * cos(az)
  const x = horiz * Math.sin(azRad);
  const z = -horiz * Math.cos(azRad);

  return [x, y, z];
}

/**
 * 16방위 능선 고도각 프로파일에서 임의의 방위각(azimuth)에 대한 능선 차폐 고도각 선형 보간(Interpolation)
 */
export function getInterpolatedRidgeAltitude(
  horizonProfile: { az: number; alt: number }[],
  azimuthDeg: number
): number {
  if (!horizonProfile || horizonProfile.length === 0) return 0;

  const normalizedAz = ((azimuthDeg % 360) + 360) % 360;

  // 프로파일을 방위각 오름차순으로 정렬
  const sorted = [...horizonProfile].sort((a, b) => a.az - b.az);

  // 정확히 일치하는 방위각 검색
  const exact = sorted.find((p) => Math.abs(p.az - normalizedAz) < 0.01);
  if (exact) return exact.alt;

  // 좌우 인접 방위각 검색
  let p1 = sorted[sorted.length - 1];
  let p2 = sorted[0];

  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].az <= normalizedAz) {
      p1 = sorted[i];
      p2 = sorted[(i + 1) % sorted.length];
    }
  }

  let span = p2.az - p1.az;
  let offset = normalizedAz - p1.az;

  // 360도 경계선 넘김 처리 (예: 337.5° ~ 0°)
  if (span < 0) {
    span += 360;
  }
  if (offset < 0) {
    offset += 360;
  }

  const ratio = span > 0 ? offset / span : 0;
  return p1.alt + (p2.alt - p1.alt) * ratio;
}
