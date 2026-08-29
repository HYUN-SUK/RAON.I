# Task Management

## Current Task: 관리자 해자 데이터 자산(/admin/moat) & 팩트검증(/admin/verifications) 정상화 완결
- [x] 관리자 해자 데이터 자산 화면(`getMoatMetrics`) RLS 우회 `createAdminClient` 및 2-Step 매핑 적용
- [x] 관리자 팩트검증 1단계 화면(`getSchedulesForVerification`) 외래키 조인 에러(`PGRST200`) 완전 제거 및 실제 컬럼명 정규화
- [x] 사업주 대면 팩트 검증(`submitOwnerVerifications`) 및 자동 루프(`runMoatAutomatedLoop`) 관리자 권한 격상
- [x] RLS 권한 및 타 기능 영향도 정밀 점검 (모바일 캠퍼 RLS 보안 100% 무결성 유지)
- [x] Next.js 16 Production Build 무결성 검증 (103/103 라우트 100% 통과)