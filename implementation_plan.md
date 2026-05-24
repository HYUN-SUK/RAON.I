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

### Automated & Manual Verification
1.  **헤더 개요 검증**: 개요 텍스트가 120자 이상일 때 잘림 없이 끝까지 온전하게 다 렌더링되는지 브라우저에서 육안 확인.
2.  **지금 출발 기능**: "지금출발" 클릭 시 현재 디바이스 시간대로 시간이 바뀌고, 뒷일정들의 시간이 정상 연동하여 바뀌는지 검증.
3.  **숨기기/보이기 기능**: 숨기기 클릭 시 확인 팝업(`AlertDialog`) 노출 및 승인 후 슬롯이 작게 접히는지 확인. 접힌 슬롯의 "보이기" 클릭 시 정상적으로 복구되는지 검증.
4.  **주소 표기**: 모든 장소 카드 하단에 도로명/지번 주소가 정상적으로 출력되는지 확인.
5.  **베이직/라이브(PRO) 모드 선택 정합성 검증 (안건 A)**:
    *   동일한 예약에 대해 'PRO' 모드로 플랜을 생성해 저장합니다.
    *   상세 페이지로 뒤로 갔다가 다시 'Basic 캠핑계획 자동 완성' 버튼을 클릭해 진입합니다.
    *   이전 PRO 캐시 데이터에 의해 화면이 라이브(PRO) 뷰로 강제 전환되지 않고, **베이직 모드의 초기 화면(경로 선택기 - RouteSelector)이 올바르게 나타나는지** 확인합니다.
    *   이 상태에서 베이직 플랜을 새로 생성하면 정상적으로 베이직 구조의 타임라인이 완성되는지 검증합니다.

---

## 🛠️ [NEW] 스마트플랜 BASIC/PRO 모드 강제 복원 충돌 해결 (안건 A)

### [SmartPlanProposal.tsx](file:///c:/Users/USER/Desktop/RAON.I/src/components/plan/SmartPlanProposal.tsx)
*   ** restoredMode 연산 로직 보완**:
    *   DB에 기존 PRO 플랜이 래핑 저장되어 있더라도, 부모가 `'BASIC'`을 직접 요청했다면 `restoredMode`를 `'BASIC'`으로 강제 고정합니다.
    *   `restoredMode`가 `'BASIC'`이지만 DB에 캐시된 모드가 `'PRO'`인 경우(불일치), `plan` 상태를 `null`로 초기화하여 호환되지 않는 PRO JSON 데이터 구조를 베이직 뷰가 로드하지 않도록 예방합니다.
    *   이를 통해 유저의 클릭 모드를 최우선으로 존중하며, 불일치 시 자동으로 경로 선택기(`RouteSelector`)부터 새로 안전하게 생성할 수 있도록 구축합니다.

### Step 5: Notification System Verification
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
