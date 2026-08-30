# Task Management

## Current Task: 관리자 예약 변경 날짜 정규화(UTC 오차 완치) & 사이트 점유/차단 철벽 방어 완결
- [x] 서버 액션 `updateReservationAction`에 `formatLocalDate` 적용 (KST 날짜 무결성 보장)
- [x] 서버 2차 가드 구축: DB `blocked_dates` 및 `reservations`(PENDING/CONFIRMED) 중복 체크
- [x] 스토어 `updateReservation`에 `blockedDates` 및 `PENDING`, `CONFIRMED` 점유 가드 탑재 (REFUND_PENDING, CANCELLED는 오픈)
- [x] 캘린더 모달 실시간 가용성 뱃지(🚫차단, 🔴예약중) 및 버튼 비활성화 가드 적용
- [x] Next.js 16 Production Build 무결성 검증 (103/103 라우트 100% 통과)