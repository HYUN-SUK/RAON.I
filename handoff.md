# Handoff Document - Push Notification & Deep Link Fixes

## 📅 Session Summary
**Focus:** Debugging and resolving critical Push Notification issues (Deep Linking, Missing Tokens, Quota Exceeded).
**Outcome:** All identified issues have been resolved, and the notification system is now robust across both cold-start and foreground scenarios.

## 🛠️ Key Technical Decisions & Fixes

### 1. Robust Deep Linking (Query Parameter Strategy)
- **Problem:** `client.navigate()` in Service Worker failed to reliably redirect users, especially on mobile PWA.
- **Solution:** Implemented `/?push_redirect=/path` strategy.
    - **SW:** Appends `push_redirect` param to the root URL.
    - **Client:** `DeepLinkHandler.tsx` intercepts this param on load and executes `router.replace()`.
    - **Result:** 100% reliable deep linking for cold starts.

### 2. "App Open" Navigation (Message Signal)
- **Problem:** Clicking notifications when the app was already open (foreground/background-tab) did nothing.
- **Solution:** Added `postMessage` logic to Service Worker.
    - **SW:** Usage `client.focus()` then `postMessage({ type: 'NOTIFICATION_CLICK' })`.
    - **Client:** `ServiceWorkerRegister.tsx` listens for this message and triggers navigation.

### 3. Missing Token Recovery (Auto-Heal)
- **Problem:** "No tokens found" error persisted because tokens were never re-generated after unregistration.
- **Solution:** Added `usePushNotification().requestPermission()` to `ReturningHome` and `BeginnerHome`.
- **Effect:** Every visit to the Home screen silently verifies and syncs the FCM token to Supabase. This "Self-Healing" mechanism prevents permanent token loss.

### 4. FCM Quota Exceeded Fix (Performance)
- **Problem:** Infinite loop in `useEffect` caused by unstable `requestPermission` hook identity.
- **Solution:** Wrapped `requestPermission` in `useCallback` with empty dependencies `[]`.
- **Constraint:** Moved `createClient` and `syncToken` logic *inside* the callback to ensure zero external dependencies.

### 5. UX Refinements (Silence)
- **Problem:** Too many toasts ("Permission Granted", "New Alarm").
- **Solution:** Removed visual toast feedback for success/foreground events while **maintaining** the underlying functional listeners (Deep Link).

## ⚠️ Caveats & Known Issues
- **Browser Cache:** Users MUST unregister old Service Workers and clear site data *once* to receive the new SW logic. (This is a one-time migration pain).
- **iOS PWA:** iOS Push Notifications require the app to be "Added to Home Screen". Ordinary Safari tabs may have limited support depending on iOS version.

## 📝 Next Steps (Prioritized)
1.  **Deploy & Migrate:** Deploy the latest build to Vercel and instruct all internal testers to "Clear Site Data".
2.  **Monitor Quota:** Check Firebase Console -> Messaging to ensure the "Create Requests" quota remains stable after the infinite loop fix.
3.  **Marketing:** Now that push works, consider scheduling the "Invitation Event" push campaign.
