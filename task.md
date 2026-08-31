# Task Management

## Current Task: 환불대기(REFUND_PENDING) 사이트 가용성 오픈 및 관리자 결제관리 Pin-to-Top 정렬 완결
- [x] `UnifiedReservationCalendar.tsx`: `getStatusForSite`, `calculateMaxDuration`, `getAirconOccupancy` 점유 조건을 `PENDING` 및 `CONFIRMED`로 정규화 (`REFUND_PENDING` 즉시 오픈)
- [x] `useReservationStore.ts`: `fetchAllReservations`의 `updatedAt` 매핑 복구 및 `fetchPublicReservations`에서 `REFUND_PENDING` 사이트 오픈
- [x] `src/app/admin/payments/page.tsx`: 전체 탭에서 `REFUND_PENDING` 및 `PENDING` 건 최상단 고정(Pin to Top) 정렬 탑재
- [x] Next.js 16 Production Build 무결성 검증 (103/103 라우트 100% 통과)