/**
 * 국토지리정보원 / 브이월드 지형 고도 데이터 6개월 주기 자동 갱신 유틸리티
 * 
 * 토목공사, 데크 증설, 지형 변형을 반영하기 위해
 * 마지막 동기화 기준 6개월(180일) 경과 시 백그라운드 재동기화(SWR)를 트리거합니다.
 */

// 6개월 유효기간 (180일 = 15,552,000,000 ms)
export const ELEVATION_CACHE_TTL_DAYS = 180;
export const ELEVATION_CACHE_TTL_MS = ELEVATION_CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;

export interface ElevationSyncStatus {
  isStale: boolean;
  status: 'fresh' | 'stale' | 'never';
  daysRemaining: number;
  lastSyncedText: string;
}

/**
 * 지형 고도 데이터의 6개월 유효기간 만료 여부 판별
 * @param lastSyncedAt 마지막 동기화 일시 (ISO String 또는 Date)
 * @returns 6개월 초과 또는 미동기화 시 true (갱신 필요)
 */
export function isElevationDataStale(lastSyncedAt?: string | Date | null): boolean {
  if (!lastSyncedAt) return true;

  const syncTime = typeof lastSyncedAt === 'string' ? new Date(lastSyncedAt).getTime() : lastSyncedAt.getTime();
  if (isNaN(syncTime)) return true;

  const now = Date.now();
  return now - syncTime >= ELEVATION_CACHE_TTL_MS;
}

/**
 * 지형 고도 데이터 동기화 상태 및 잔여 유효일수 계산
 */
export function getElevationSyncStatus(lastSyncedAt?: string | Date | null): ElevationSyncStatus {
  if (!lastSyncedAt) {
    return {
      isStale: true,
      status: 'never',
      daysRemaining: 0,
      lastSyncedText: '동기화 기록 없음',
    };
  }

  const syncDate = typeof lastSyncedAt === 'string' ? new Date(lastSyncedAt) : lastSyncedAt;
  const syncTime = syncDate.getTime();

  if (isNaN(syncTime)) {
    return {
      isStale: true,
      status: 'never',
      daysRemaining: 0,
      lastSyncedText: '잘못된 날짜',
    };
  }

  const now = Date.now();
  const elapsedMs = now - syncTime;
  const remainingMs = ELEVATION_CACHE_TTL_MS - elapsedMs;
  const daysRemaining = Math.max(0, Math.floor(remainingMs / (24 * 60 * 60 * 1000)));
  const isStale = elapsedMs >= ELEVATION_CACHE_TTL_MS;

  const formattedDate = `${syncDate.getFullYear()}.${String(syncDate.getMonth() + 1).padStart(2, '0')}.${String(syncDate.getDate()).padStart(2, '0')}`;

  return {
    isStale,
    status: isStale ? 'stale' : 'fresh',
    daysRemaining,
    lastSyncedText: `${formattedDate} (${isStale ? '6개월 만료됨' : `${daysRemaining}일 유효`})`,
  };
}
