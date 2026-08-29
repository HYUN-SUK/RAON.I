# Task Management

## Current Task: 관리자 입금확인 및 삭제/취소 반응 속도 초고속화 (0.01초 즉시 반영)
- [x] 관리자 대시보드 & 통합캘린더 입금확인/삭제 로직 및 병목 구간 정밀 점검
- [x] FCM 푸시 및 빈자리 대기자 알림(`notifyWaitlistUsers`) 백그라운드 비동기 분리
- [x] Zustand Store `updateReservationStatus` 낙관적 UI(Optimistic Update) 및 롤백 가드 탑재
- [x] 통합캘린더, 상세모달, 오늘입실, 결제관리 내 `fetchAllReservations` 불필요한 중복 재조회 전면 제거
- [x] Next.js 16 Production Build 무결성 검증 (103/103 라우트 100% 통과)