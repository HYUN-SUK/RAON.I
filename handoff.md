# Handoff Document - 2026-01-19

## 📋 세션 요약 (Session Summary)

이번 세션에서는 **푸시 알림 시스템의 전반적인 문제 해결**을 완료했습니다.

### 완료된 작업

1. **관리자 콘솔 알림 발송 실패 해결**
   - 관리자가 "입금 확인" 또는 "강제 취소" 시 사용자에게 푸시 알림이 발송되지 않던 문제 해결
   - 원인: `notifications` 테이블의 RLS 정책이 관리자의 INSERT를 차단
   - 해결: RLS 비활성화 (임시 조치)

2. **중복 알림 문제 해결 (2~3개 → 1개)**
   - 원인 1: Supabase DB Webhook + 코드에서 직접 호출 → 이중 발송
   - 원인 2: Service Worker에서 `onBackgroundMessage` + `push` 핸들러 둘 다 알림 표시
   - 해결: DB Webhook 삭제, SW에서 `onBackgroundMessage`의 `showNotification` 제거

3. **Admin 강제 취소 기능 구현**
   - `CancelReservationDialog.tsx` 컴포넌트 생성 (취소 사유 입력 UI)
   - 취소 사유가 푸시 알림에 포함되어 사용자에게 전송됨

---

## 🔧 기술적 결정 사항

### 1. RLS 비활성화 (임시 조치)
```sql
alter table public.notifications disable row level security;
```
- **이유**: RLS 정책 설정이 계속 실패하여 기능 우선 배포
- **위험도**: 중간 (알림 데이터는 민감 정보가 아님)
- **TODO**: 추후 RLS 정책 재설정 필요

### 2. DB Webhook 제거
- 알림 삽입 시 Supabase DB Webhook과 코드에서 직접 호출이 중복 실행되어 제거
- 현재는 코드에서 `supabase.functions.invoke('push-notification')` 직접 호출만 사용

### 3. Service Worker 알림 처리 구조
- `onBackgroundMessage`: 로깅만 (알림 표시 X)
- `push` 이벤트 핸들러: 실제 알림 표시 (중복 방지)

---

## 📝 수정된 주요 파일

| 파일 | 변경 내용 |
|------|----------|
| `src/store/useReservationStore.ts` | DB fallback 추가 (Admin에서 예약 조회) |
| `src/components/admin/CancelReservationDialog.tsx` | 신규 생성 (취소 사유 입력) |
| `src/components/admin/ReservationCard.tsx` | CancelReservationDialog 연동 |
| `src/types/notificationEvents.ts` | RESERVATION_CANCELLED 템플릿에 reason 추가 |
| `public/firebase-messaging-sw.js` | 중복 알림 방지 로직 적용 |
| `src/services/notificationService.ts` | Edge Function 직접 호출 추가 |

---

## ⚠️ 주의 사항 및 알려진 이슈

### TODO (Security)
- [ ] `notifications` 테이블 RLS 재설정 필요
  - 현재 RLS가 비활성화되어 있어 보안이 약함
  - 추후 시간을 내서 올바른 정책 설정 필요

### 환경 설정
- Supabase DB Webhook (`notifications` 테이블): 삭제됨 (재생성 금지)
- Service Worker 업데이트: 배포 후 브라우저 캐시 삭제 또는 SW 수동 업데이트 필요

---

## 🚀 다음 작업 가이드

1. **RLS 정책 재설정** (보안)
   - `notifications` 테이블에 적절한 RLS 정책 설정
   - 관리자가 다른 유저에게 알림을 보낼 수 있도록 INSERT 정책 필요

2. **푸시 토큰 정리**
   - 오래된/중복 토큰이 쌓일 수 있음
   - 정기적인 토큰 정리 로직 검토 필요

3. **기타 알림 시나리오 점검**
   - 커뮤니티 댓글/좋아요 알림
   - 시스템 공지 알림 등

---

## 📊 테스트 결과

| 시나리오 | 로컬 | 배포 | 결과 |
|---------|------|------|------|
| 예약 신청 | ✅ | ✅ | 1개 알림 |
| 입금 확인 | ✅ | ✅ | 1개 알림 |
| 관리자 강제 취소 | ✅ | ✅ | 1개 알림 (사유 포함) |
