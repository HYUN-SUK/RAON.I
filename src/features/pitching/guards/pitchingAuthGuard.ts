/**
 * 가상 피칭 & 날씨 시뮬레이터 보안 권한 판별 가드
 * 
 * 허용 기준:
 * 1. 슈퍼 관리자 (admin@raon.ai, role === 'admin' 또는 'super_admin')
 * 2. 대표님 계정 (tootg@naver.com, 또는 tootg 포함 계정)
 * 그 외 모든 사용자 및 비인가 요청은 404 차단 대상.
 */
export function isAuthorizedPitchingUser(
  email?: string | null,
  role?: string | null
): boolean {
  if (!email && !role) return false;

  const normalizedEmail = (email || '').toLowerCase().trim();
  const normalizedRole = (role || '').toLowerCase().trim();

  // 1. 관리자 권한 확인
  if (
    normalizedRole === 'admin' ||
    normalizedRole === 'super_admin' ||
    normalizedEmail === 'admin@raon.ai'
  ) {
    return true;
  }

  // 2. 대표님 전용 계정(tootg) 확인
  if (
    normalizedEmail === 'tootg@naver.com' ||
    normalizedEmail.startsWith('tootg@') ||
    normalizedEmail.includes('tootg')
  ) {
    return true;
  }

  return false;
}
