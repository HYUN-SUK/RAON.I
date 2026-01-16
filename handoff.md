# 📋 Session Handoff: Push Notification Fixed & Deployment Prep

## 📅 Session Info
- **Date:** 2026-01-16
- **Focus:** Push Notification Debugging, Infrastructure Fix, Live Verification

## ✅ Completed Work
1.  **Push Notification Debugging (RESOLVED)**:
    -   **Issue**: Client requested Push Notification but none received.
    -   **Root Cause 1 (Infra)**: DB Trigger/Webhook was missing for `notifications` table.
    -   **Root Cause 2 (RLS)**: `notifications` table RLS blocked `INSERT` from authenticated users (Error 42501).
    -   **Fix**:
        -   **Refactor**: Changed `notificationService.ts` to **directly invoke** `push-notification` Edge Function (bypassing complex Webhook setup).
        -   **Policy**: Added RLS policy `Users can insert their own notifications` to allow reservation logic to queue notifications.
    -   **Verification**: Verified via Localhost Browser.
        -   Scenario: Reservation (Bank Transfer) -> 2026-01-17 ~ 21 (Younghee-ne).
        -   Result: Console Log "[NotificationService] Edge Function success".
2.  **Documentation**:
    -   Updated `RAON_MASTER_ROADMAP_v3.md` (Phase 9.1 Completed).
    -   Updated `task.md` with debug results.

## ⚠️ Current Issues & Caveats
-   **FCM Token**: 실제 기기 수신은 FCM Token의 유효성 및 권한(Notification Permission)에 따라 달라질 수 있음. (Server-side 발송 성공은 확인됨).
-   **Email Logic**: 이메일 발송 로직은 현재 `console.log`로만 처리되어 있음 (향후 Resend 등 연동 필요 시 챙겨야 함).

## 📝 Next Guide (For Next Session)
1.  **Production Deployment**:
    -   [ ] Git Push & Vercel Auto-Deployment Check.
    -   [ ] Real Device Test (iOS/Android PWA).
2.  **Post-Deployment**:
    -   [ ] Vercel Environment Variables (`SUPABASE_SERVICE_ROLE_KEY` etc.) double-check.
    -   [ ] Monitor `notifications` table for `sent` status in production.

## 📌 Technical notes
-   **Edge Function Invocation**: `supabase.functions.invoke('push-notification', { body: { record: ... } })` pattern established for reliable execution.
-   **RLS Policy**: `supabase/migrations/20260117_fix_notification_rls.sql` is critical. Ensure it is applied to production DB.
