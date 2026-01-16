# Handoff: Mobile Reservation & Notification Fix

## 📅 Session: 2026-01-16 (Late Night)

## 🚧 Resolved Issues
1.  **Mobile Reservation Invisible in Admin Console**
    *   **Root Cause 1 (RLS)**: Row Level Security policies prevented Admin (`admin@raon.ai`) from viewing reservations made by others.
    *   **Root Cause 2 (Logic)**: `AdminReservationsPage` component was missing the `fetchAllReservations` call, so it never actually requested data from the DB.
    *   **Fix**:
        *   Applied `fix_admin_rls_v2.sql` to allow Admin email/metadata to `SELECT`.
        *   Updated `useReservationStore.ts` to add `fetchAllReservations`.
        *   Updated `src/app/admin/reservations/page.tsx` to call `fetchAllReservations` on mount.

2.  **Push Notification Failure**
    *   **Root Cause**:
        *   **Local**: RLS blocked `INSERT` into `notifications`.
        *   **Production**: Supabase Edge Function (`push-notification`) was missing Firebase Secrets and wasn't deployed.
    *   **Fix**:
        *   Applied `fix_notification_rls.sql`.
        *   Used `supabase secrets set` to upload Firebase Credentials.
        *   Deployed Edge Function via `supabase functions deploy`.

## 🛠 Key Changes
*   `supabase/migrations/20260117_fix_admin_rls_v2.sql`: Robust Admin RLS policy.
*   `src/store/useReservationStore.ts`: Added `fetchAllReservations`.
*   `src/app/admin/reservations/page.tsx`: Added data fetching logic.
*   `supabase/migrations/20260117_fix_notification_rls.sql`: User insert permission for notifications.

## 📝 Next Steps
*   **Verify Deployment**: Monitor the Vercel deployment of the latest commit.
*   **Monitor Logs**: Check Supabase Edge Function logs if any future notifications fail.
*   **Clean Up**: The SQL migration files can be organized/archived in a future DB maintenance session.
