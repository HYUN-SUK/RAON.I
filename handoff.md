# 📋 Session Handoff: Push Notification Debugging

## 📅 Session Info
- **Date:** 2026-01-16
- **Focus:** Weather Logic Fix, Push Notification Sys Implementation

## ✅ Completed Work
1.  **Weather Consistency Fix**:
    -   `useWeather.ts`: `toISOString` (UTC) 제거 및 Epoch Time 비교 로직 적용. KST 데이터와의 시간 불일치 해결.
    -   `WeatherDetailSheet.tsx`: 중복/부정확한 온도 계산 로직 제거 (`weather.temp` SSOT 준수).
2.  **Push Notification Logic Fix**:
    -   **Problem**: 예약 완료 시 알림 발송 코드가 누락되어 있었음. 예약 완료 페이지와 중복되는 문제도 있었음.
    -   **Fix**:
        -   `useReservationStore.ts`: `createReservationSafe` (신청), `requestCancelReservation` (취소) 성공 시 `notificationService` 호출 로직 추가.
        -   `complete/page.tsx`: 중복 발송되던 불안정한 페이지 레벨 알림 로직 제거.
        -   Lint Fix: 불필요한 중복 import 제거.

## ⚠️ Current Issues (CRITICAL)
-   **증상**: 코드는 정상적으로 수정하여 배포했으나, **실제 모바일 기기로 푸시 알림이 도착하지 않음.**
-   **코드 상태**: `notificationService.dispatchNotification`은 정상 호출되고 있으며, DB `notifications` 테이블에 큐잉까지는 될 것으로 추정됨.
-   **추정 원인** (Backend/Infra):
    1.  **Supabase Secrets 미설정**: Edge Function이 Firebase에 접근하기 위한 환경변수(`FIREBASE_PROJECT_ID`, `client_email`, `private_key`)가 Supabase Dashboard에 설정되어 있지 않을 가능성 높음.
    2.  **Database Webhook 미연결**: `notifications` 테이블에 INSERT 될 때 `push-notification` Edge Function을 트리거하는 **Webhook** 설정이 빠져있을 가능성. (코드만 배포한다고 자동 연결되지 않음)
    3.  **Service Worker**: `firebase-messaging-sw.js` 등록 실패 또는 브라우저 권한 문제.

## 📝 Next Guide (For Next Session)
1.  **Supabase 설정 확인 (1순위)**:
    -   [ ] [Supabase Dashboard] -> Edge Functions -> `push-notification` 로그 확인 (에러 메시지 확인).
    -   [ ] [Supabase Dashboard] -> Project Settings -> Secrets에 Firebase 인증 정보 등록 여부 확인.
    -   [ ] [Supabase Dashboard] -> Database -> Webhooks에서 `notifications` 테이블 INSERT 시 Function 호출 트리거 설정 확인.
2.  **Client Debugging**:
    -   [ ] PC 브라우저 개발자 도구에서 `notificationService` 호출 시 에러 로그 확인.
    -   [ ] `notifications` 테이블 조회: 데이터가 쌓이고 있는지, status가 `queued`에서 `sent`로 바뀌는지 `error`인지 확인.

## 📌 Technical notes
-   알림 템플릿(`notificationEvents.ts`) 확인 결과, 취소 알림에는 환불 금액 정보가 필요 없어 추가 파라미터 작업 불필요.
-   `useReservationStore`에서 알림 발송은 `Fire & Forget` (await 안 함) 방식으로 처리되어 UI 멈춤 없음.
