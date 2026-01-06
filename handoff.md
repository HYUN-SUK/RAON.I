# Handoff Document
**작성일**: 2026-01-06
**작업자**: Antigravity (Google Deepmind)
**세션**: 예약 변경 기능, 푸시 템플릿 상세화, FCM 서버 사이드 코드

## 📝 세션 요약 (Session Summary)
이번 세션에서는 **예약 변경 기능 구현**과 **푸시 알림 시스템 완료(템플릿 상세화 + Edge Function)**를 진행했습니다.

---

## ✅ 완료된 작업

### 1. 예약 변경 기능 (관리자 전용)
- **Store**: `updateReservation` 액션 (일정/사이트 변경 + 중복 검증 + 차액 계산)
- **UI**: 캘린더 상세 다이얼로그에 '예약 변경' 버튼 → 변경 폼 모달
- **기능**: 입실일/기간/사이트 변경 시 실시간 가격 차액 계산 및 표시
- **연동**: 변경 확정 시 `RESERVATION_CHANGED` 푸시 알림 발송

### 2. 푸시 알림 고도화
- **템플릿 상세화**:
  - `RESERVATION_SUBMITTED`: 입금 계좌/금액/기한 정보 포함
  - `RESERVATION_CONFIRMED`: 입퇴실 시간, 매너타임 등 이용안내 포함
  - `RESERVATION_CHANGED`: 변경 전/후 일정, 차액 정보 포함
- **예약 완료 알림**: `ReservationCompletePage` 진입 시 알림 발송 (단, UUID 없는 Guest는 제외)
- **안전장치**: `notificationService.ts`에 UUID 검증 로직 추가 (Guest insert 오류 방지)

### 3. 실제 FCM 발송 (서버 사이드)
- **Edge Function 코드 작성**: `supabase/functions/push-notification/index.ts`
- **로직**: `notifications` 테이블 Insert 트리거 → Google OAuth → FCM HTTP v1 API 전송

---

## 🚦 다음 작업 가이드 (Next Steps)

### ⚠️ 필수 실행 (Action Required)
1. **DB 마이그레이션 적용**
   - 파일: `supabase/migrations/20260106_notifications_v2.sql`
   - Supabase 대시보드 SQL Editor에서 실행하여 테이블에 `event_type`, `data`, `sent_at` 컬럼 추가

2. **Edge Function 배포 및 설정**
   - **배포**: `supabase functions deploy push-notification`
   - **환경변수 설정** (`.env.local` 내용 참고하여 Supabase Secrets에 등록):
     - `FIREBASE_PROJECT_ID`
     - `FIREBASE_CLIENT_EMAIL`
     - `FIREBASE_PRIVATE_KEY` (JSON의 private_key 값 전체)
     - `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`
   - **Webhook 연결**: `notifications` 테이블 INSERT 시 해당 Edge Function 호출하도록 Database Webhook 설정 (또는 SQL 내 `pg_notify` 리스너 구현)

---

## 📁 수정된 파일
| 파일 | 변경 내용 |
|------|----------|
| `src/store/useReservationStore.ts` | 예약 변경 액션 추가 |
| `src/components/admin/UnifiedReservationCalendar.tsx` | 예약 변경 UI 구현 |
| `src/types/notificationEvents.ts` | 알림 템플릿 상세화 |
| `src/services/notificationService.ts` | UUID 검증 로직 추가 (Crash 방지) |
| `supabase/functions/push-notification/index.ts` | FCM 발송 Edge Function (신규) |

---

## 🔍 검증 결과
- **예약 변경**: 캘린더에서 정상적으로 변경 및 차액 계산 확인.
- **알림 큐**: Admin 페이지에서 `RESERVATION_CONFIRMED` 등 알림 큐 적재 확인.
- **Guest 처리**: 비로그인 예약 시 알림 발송 시도 차단하여 에러 방지 확인.
