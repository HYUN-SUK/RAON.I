# Session Handoff - Push Notification Debugging & Admin Fixes

**Date**: 2026-01-16
**Status**: ✅ SUCCESS (All Critical Issues Resolved)

## 📌 One-Line Summary
Resolved critical issues preventing push notifications (Firebase Auth/Env), fixed admin reservation visibility (RLS), and cleaned up duplicate notifications (Token Deduplication).

## 🛠️ Key Achievements

### 1. Push Notification Fix (`push-notification` Edge Function)
- **Issue**: Firebase `401 Unauthorized` and `404 Unregistered` errors.
- **Root Cause**:
  1. Missing Firebase Service Account keys in Supabase Secrets (`FIREBASE_PROJECT_ID` etc.).
  2. Missing `NEXT_PUBLIC_FIREBASE_*` keys in Vercel Production Environment.
  3. JWT generation code missing `iat` (issued at) claim.
  4. Expired FCM tokens (from 2026-01-04).
- **Fix**:
  - Added full Service Account JSON to Supabase Secrets.
  - Added all 7 Firebase Client keys to Vercel Environment Variables.
  - Updated `index.ts` to include `.setIssuedAt()` in JWT builder.
  - Guided user to re-enable permissions to generate fresh tokens.

### 2. Admin Reservation Visibility
- **Issue**: Reservations not showing in Admin Console.
- **Fix**:
  - Implemented `fetchAllReservations` in `useReservationStore.ts`.
  - Updated `20260117_fix_admin_rls_v2.sql` to grant Admins (`admin@raon.ai`) full SELECT access to `reservations` and `notifications` tables via RLS policies.
  - Verified Admin Console now correctly lists all user reservations.

### 3. Duplicate Notification Fix
- **Issue**: Users received 2+ notifications for single events.
- **Root Cause**: Multiple FCM tokens (old + new) registered for the same user.
- **Fix**:
  - Ran cleanup script to delete duplicate tokens, keeping only the most recent one.
  - Updated `push_tokens` table logic (implicitly verified via cleanup).

## 📝 Code Changes
- **Supabase**:
  - `migrations/20260117_fix_admin_rls_v2.sql`: Comprehensive RLS fix for Admin access.
  - `functions/push-notification/index.ts`: Added robust JWT logic and better error handling.
- **Client**:
  - `.env.local`: Added `FIREBASE_PROJECT_ID` (Server) and `NEXT_PUBLIC_FIREBASE_PROJECT_ID` (Client).
  - `src/lib/firebase.ts` & `src/hooks/usePushNotification.ts`: Removed debug logs, stabilized token logic.
- **Documentation**:
  - Updated `task.md` and `RAON_MASTER_ROADMAP_v3.md`.

## ⏭️ Next Steps
- **Monitor**: Watch for any "NotRegistered" errors in Supabase logs (indicates users need to re-visit site).
- **Design**: Continue with Phase 9 tasks (PWA Store registration, Type generation) if desired.
- **Routine**: No immediate action required. System is stable.

## ⚠️ Notes for Deployment
- **Vercel**: `NEXT_PUBLIC_FIREBASE_*` variables are now set. Any changed keys require a Redeploy.
- **Supabase**: Secrets are set. If keys rotate, update via `npx supabase secrets set`.
