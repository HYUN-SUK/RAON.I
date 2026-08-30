# Task Management

## Current Task: 관리자 예약 변경 순수 날짜 문자열 직렬화(UTC 오차 0% 박멸) & 3-State UX 로딩 완결
- [x] 클라이언트 스토어(`useReservationStore.ts`)에서 순수 날짜 문자열(`YYYY-MM-DD`) 직접 전달로 Next.js Date 직렬화 오차 0% 박멸
- [x] 서버 액션 `updateReservationAction`에 순수 문자열 수신 및 DB `blocked_dates`(`start_date`, `end_date`) 스키마 일치화
- [x] `UnifiedReservationCalendar.tsx` [변경 확정] 버튼에 `isSubmittingModify` 3-State UX 로딩 스피너 및 비활성화 가드 탑재
- [x] Next.js 16 Production Build 무결성 검증 (103/103 라우트 100% 통과)