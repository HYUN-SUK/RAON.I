# Task Management

## Current Task: 스마트플랜 날씨 브리핑 KST 타임존 정규화(UTC 9시간 시차 왜곡 완치) 완결
- [x] `src/lib/smartPlan.ts`: `toKstYMD`, `toKstDashDate` 표준 함수 적용 및 D-Day/기상청 날짜 필터링 KST 정규화
- [x] `src/components/plan/SmartPlanProposal.tsx`: `toISOString()` 대신 로컬 `YYYY-MM-DD` 문자열 직송 적용
- [x] Next.js 16 Production Build 무결성 검증 (103/103 라우트 100% 통과)