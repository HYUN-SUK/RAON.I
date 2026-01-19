# Handoff: Push Notification Debugging

## Current Status
- **Goal**: Fix "Reservation Confirmed" notification and implement "Admin Force Cancel".
- **Progress**:
  - Found logic gap (missing payload) -> **Fixed**.
  - Implemented Admin Cancel Dialog (Reason Input) -> **Done**.
  - Restored Direct Edge Function Call -> **Done**.
  - **Result**: `Localhost` test works perfectly. `Production` (Vercel) fails to deliver push.

## Critical Issues (To Be Solved Next Session)
1.  **Production Push Failure**:
    -   Even with direct Edge Function call, the user reports "No push on phone".
    -   **Suspects**:
        -   **Edge Function Logs**: Need to check if `push-notification` function is actually running and what error it returns.
        -   **FCM Credentials**: Is the `service-account.json` or FCM Key correct in the Production Supabase Secrets?
        -   **RLS/Permissions**: Does the Edge Function have the `service_role` key to bypass RLS when querying tokens?

## Next Actions
1.  **Check Supabase Edge Function Logs**: Ask user to copy/paste logs from Dashboard.
2.  **Verify Production Secrets**: Ensure `SUPABASE_SERVICE_ROLE_KEY` and FCM keys are set in Supabase Dashboard.
3.  **Test with Curl**: Try invoking the function manually with curl to isolate the issue.
