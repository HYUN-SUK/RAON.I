# Notification System Reorganization Plan

## 1. Current Status Analysis
- **Architecture Mismatch**: The `docs/notification_manual.md` specifies a **DB Trigger** architecture (Option A), but the trigger was removed in `20260216_remove_push_trigger.sql`.
- **Critical Bug**: Admin actions (Confirm/Cancel) currently insert notifications into the DB but **do not send Pushes** because the trigger is missing.
- **Legacy Code**: `supabase/functions/camping-reminder` manually calls the `push-notification` Edge Function, violating the "DB Insert Only" rule.
- **Type Issue**: `UPCOMING_STAY_D4` event type is missing in `notificationEvents.ts`, but used in logic (mapped to `d1`).

## 2. Objectives
1.  **Restore Architecture**: Re-implement the DB Trigger to handle `status='queued'`.
2.  **Fix Logic**: Update `notificationService.ts` and `camping-reminder` to insert with `status='queued'` and rely on the trigger.
3.  **Standardize**: Ensure all system parts follow the "Insert & Forget" pattern.

## 3. Implementation Steps

### Step 1: Restore DB Trigger [Critical]
- Create `supabase/migrations/20260219_restore_push_trigger.sql`.
- Logic: `AFTER INSERT ON notifications FOR EACH ROW WHEN (NEW.status = 'queued') EXECUTE FUNCTION handle_new_notification()`.

### Step 2: Fix `notificationService.ts`
- **Current**: Inserts with `status: 'processing'`.
- **Fix**: Change to `status: 'queued'` to match the trigger condition.

### Step 3: Fix `camping-reminder` Edge Function
- **Current**: Manually fetches `push-notification` endpoint.
- **Fix**: 
  - Remove `fetch` calls.
  - Insert notifications with `status: 'queued'`.
  - Update D-4 logic to use a proper event type (or confirm `NotificationEventType` definitions).

### Step 4: Update Types (`notificationEvents.ts`)
- Add `UPCOMING_STAY_D4` to `NotificationEventType`.
- Add config for `UPCOMING_STAY_D4` (Template: "4일 남았습니다!").

## 4. Verification Plan

### Automated/Manual Tests
1.  **D-4 Reminder Test**:
    - Run `camping-reminder` function logic (or mock it).
    - Check DB: New row in `notifications` with `status='queued'` and `event_type='upcoming_stay_d4'`.
    - Check Edge Function Logs: Confirm `handle_new_notification` fired and called `push-notification`.
    
2.  **Admin Action Test**:
    - Use "Reservation Confirmation" in Admin Panel.
    - Check DB: New row in `notifications`.
    - Receiver Side: Verify Push interaction (if possible) or Logs.

3.  **Duplicate Check**:
    - Ensure only ONE push log appears per event.
