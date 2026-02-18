# Push Notification Reliability Fix

## [Goal Description]
The user reported missing D-day/D-1/D-4 push notifications.
Diagnosis reveals that the **Database Trigger** (`trigger_push_notification`) aimed at invoking the `push-notification` Edge Function is failing silently (likely due to `pg_net` configuration or issues).
However, the `push-notification` Edge Function itself is healthy and works when called directly.

To fix this **permanently and reliably**, we will change the architecture for Scheduled Notifications:
Instead of relying on `DB Insert -> Trigger -> Edge Function`, we will make the `camping-reminder` Edge Function **directly invoke** the `push-notification` function.

## Proposed Changes

### 1. Modify `camping-reminder` Edge Function
#### [MODIFY] [supabase/functions/camping-reminder/index.ts](file:///c:/Users/USER/Desktop/RAON.I/supabase/functions/camping-reminder/index.ts)
- Import `PROJECT_REF` or use `SUPABASE_URL` to derive the function URL.
- After batch inserting notifications, iterate through them and call `push-notification` via `fetch`.
- Use `SUPABASE_SERVICE_ROLE_KEY` for authorization.
- Log success/failure of these direct calls.

### 2. Cleanup Broken Trigger (Optional but recommended)
#### [NEW] [supabase/migrations/20260216_remove_broken_trigger.sql](file:///c:/Users/USER/Desktop/RAON.I/supabase/migrations/20260216_remove_broken_trigger.sql)
- Drop `trigger_push_notification` to prevent confusion and double-sending (if it ever starts working).

## Verification Plan
1. **Redeploy**: User must redeploy `camping-reminder` function.
2. **Test**: Since we cannot simulate time easily on server, we will rely on the direct invocation logic which we verified via script.
